#!/usr/bin/env node
/**
 * Fail when a store-bound build can bake EXPO_PUBLIC_PARITY into the app.
 *
 * apps/mobile/app/login.tsx auto-submits a deep-link password when that flag
 * is "1". Production and preview EAS profiles must not set it, including
 * values inherited through `extends` and any other build profile whose
 * `extends` chain reaches them. A CI job that runs `eas build` or `eas submit`
 * for those profiles must not set the flag either.
 *
 * `.github/workflows/play-store-screenshots.yml` (emulator capture, PR #53)
 * may set the flag only while that workflow has no `eas build` or `eas submit`
 * step. The moment it gains one, it is checked like every other workflow.
 *
 * Usage:
 *   node scripts/check-no-parity-in-store-builds.mjs
 *   node scripts/check-no-parity-in-store-builds.mjs --self-test
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FLAG = "EXPO_PUBLIC_PARITY";
const STORE_PROFILES = new Set(["production", "preview"]);
const SCREENSHOT_WORKFLOW = ".github/workflows/play-store-screenshots.yml";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

class ScanError extends Error {}

/**
 * @param {unknown} eas
 * @param {string} file
 * @returns {string[]}
 */
export function checkEasConfig(eas, file = "apps/mobile/eas.json") {
  if (!eas || typeof eas !== "object" || Array.isArray(eas)) {
    return [`${file}: eas config is not an object`];
  }
  const build = /** @type {{ build?: unknown }} */ (eas).build;
  if (build === undefined) return [];
  if (!build || typeof build !== "object" || Array.isArray(build)) {
    return [`${file}: "build" is not an object`];
  }
  const profiles = /** @type {Record<string, unknown>} */ (build);
  /** @type {string[]} */
  const errors = [];
  const resolve = makeEnvResolver(profiles);

  for (const name of Object.keys(profiles)) {
    const store = storeProfileReached(profiles, name);
    if (!store) continue;
    const resolved = resolve(name);
    if (resolved.error) {
      errors.push(`${file}: build profile "${name}": ${resolved.error}`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolved.env, FLAG)) continue;
    const value = JSON.stringify(resolved.env[FLAG]);
    const source = resolved.sources[FLAG];
    /** @type {string[]} */
    const notes = [];
    if (source !== name) notes.push(`inherited from "${source}"`);
    if (store !== name) notes.push(`extends "${store}"`);
    const suffix = notes.length ? ` (${notes.join(", ")})` : "";
    errors.push(`${file}: build profile "${name}" sets ${FLAG} to ${value}${suffix}`);
  }
  return errors;
}

/**
 * @param {string} text
 * @param {string} file
 * @returns {string[]}
 */
export function checkWorkflowYaml(text, file) {
  /** @type {Record<string, unknown>} */
  let doc;
  try {
    const parsed = parseWorkflowYaml(text, file);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return [`${file}: workflow is not a mapping`];
    }
    doc = /** @type {Record<string, unknown>} */ (parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`${file}: cannot scan workflow (${message})`];
  }

  if (file === SCREENSHOT_WORKFLOW && !documentRunsEas(doc)) return [];
  return errorsInWorkflow(doc, file);
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function checkRepository(root) {
  /** @type {string[]} */
  const errors = [];
  const easPath = path.join(root, "apps/mobile/eas.json");
  let eas;
  try {
    eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`apps/mobile/eas.json: cannot read build profiles (${message})`];
  }
  errors.push(...checkEasConfig(eas, "apps/mobile/eas.json"));

  const workflowDir = path.join(root, ".github/workflows");
  if (!fs.existsSync(workflowDir)) return errors;
  const files = fs
    .readdirSync(workflowDir)
    .filter((name) => name.endsWith(".yml"))
    .sort();
  for (const name of files) {
    const rel = `.github/workflows/${name}`;
    const text = fs.readFileSync(path.join(workflowDir, name), "utf8");
    errors.push(...checkWorkflowYaml(text, rel));
  }
  return errors;
}

/**
 * @param {Record<string, unknown>} profiles
 */
function makeEnvResolver(profiles) {
  /** @type {Map<string, { env: Record<string, unknown>, sources: Record<string, string>, error?: string }>} */
  const cache = new Map();

  /**
   * @param {string} name
   * @param {string[]} [stack]
   */
  function resolve(name, stack = []) {
    if (stack.includes(name)) {
      return {
        env: {},
        sources: {},
        error: `extends cycle: ${[...stack, name].join(" -> ")}`,
      };
    }
    const cached = cache.get(name);
    if (cached) return cached;

    const profile = profiles[name];
    if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
      return {
        env: {},
        sources: {},
        error: `missing profile "${name}"`,
      };
    }
    const record = /** @type {Record<string, unknown>} */ (profile);
    /** @type {Record<string, unknown>} */
    let env = {};
    /** @type {Record<string, string>} */
    let sources = {};

    if (record.extends !== undefined) {
      if (typeof record.extends !== "string" || record.extends.trim() === "") {
        const result = {
          env: {},
          sources: {},
          error: `invalid extends value ${JSON.stringify(record.extends)}`,
        };
        cache.set(name, result);
        return result;
      }
      const parentName = record.extends.trim();
      const parent = resolve(parentName, [...stack, name]);
      if (parent.error) {
        const result = {
          env: {},
          sources: {},
          error: `extends "${parentName}": ${parent.error}`,
        };
        cache.set(name, result);
        return result;
      }
      env = { ...parent.env };
      sources = { ...parent.sources };
    }

    if (record.env !== undefined) {
      if (!record.env || typeof record.env !== "object" || Array.isArray(record.env)) {
        const result = {
          env: {},
          sources: {},
          error: "env is not an object",
        };
        cache.set(name, result);
        return result;
      }
      for (const [key, value] of Object.entries(record.env)) {
        env[key] = value;
        sources[key] = name;
      }
    }

    const result = { env, sources };
    cache.set(name, result);
    return result;
  }

  return resolve;
}

/**
 * @param {Record<string, unknown>} profiles
 * @param {string} name
 * @param {string[]} [stack]
 * @returns {string | null} "production" or "preview" when this profile is one of them or extends one.
 */
function storeProfileReached(profiles, name, stack = []) {
  if (STORE_PROFILES.has(name)) return name;
  if (stack.includes(name)) return null;
  const profile = profiles[name];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) return null;
  const parent = /** @type {{ extends?: unknown }} */ (profile).extends;
  if (typeof parent !== "string" || parent.trim() === "") return null;
  const parentName = parent.trim();
  if (STORE_PROFILES.has(parentName)) return parentName;
  return storeProfileReached(profiles, parentName, [...stack, name]);
}

/**
 * @param {Record<string, unknown>} doc
 * @param {string} file
 * @returns {string[]}
 */
function errorsInWorkflow(doc, file) {
  const jobs = doc.jobs;
  if (jobs === undefined || jobs === null) return [];
  if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) {
    return [`${file}: "jobs" is not a mapping`];
  }
  /** @type {string[]} */
  const errors = [];
  const workflowEnv = doc.env;
  for (const [jobId, job] of Object.entries(jobs)) {
    if (!job || typeof job !== "object" || Array.isArray(job)) {
      errors.push(`${file}: job "${jobId}" is not a mapping`);
      continue;
    }
    const record = /** @type {Record<string, unknown>} */ (job);
    const sites = flagSites(workflowEnv, record);
    const invocations = easInvocationsInJob(record);
    if (invocations.error) {
      errors.push(`${file}: job ${formatJob(jobId, record)}: ${invocations.error}`);
      continue;
    }
    if (sites.length === 0 || invocations.commands.length === 0) continue;
    for (const command of invocations.commands) {
      const profiles = profilesForCommand(command, record);
      for (const profile of profiles) {
        if (profile.unknown) {
          errors.push(
            `${file}: job ${formatJob(jobId, record)} sets ${FLAG} (${sites.join(", ")}) and runs eas ${command.kind} with a profile that is not statically known (${profile.raw})`,
          );
          continue;
        }
        if (!STORE_PROFILES.has(profile.name)) continue;
        const how = profile.defaulted ? " (default when --profile is omitted)" : "";
        errors.push(
          `${file}: job ${formatJob(jobId, record)} sets ${FLAG} (${sites.join(", ")}) and runs eas ${command.kind} with profile "${profile.name}"${how}`,
        );
      }
    }
  }
  return errors;
}

/**
 * @param {unknown} workflowEnv
 * @param {Record<string, unknown>} job
 * @returns {string[]}
 */
function flagSites(workflowEnv, job) {
  /** @type {string[]} */
  const sites = [];
  if (mappingProblem(workflowEnv)) sites.push("workflow env is not an object");
  else if (envSetsFlag(workflowEnv)) sites.push("workflow env");
  if (mappingProblem(job.env)) sites.push("job env is not an object");
  else if (envSetsFlag(job.env)) sites.push("job env");
  const steps = Array.isArray(job.steps) ? job.steps : [];
  steps.forEach((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step)) return;
    const record = /** @type {Record<string, unknown>} */ (step);
    const label =
      typeof record.name === "string" ? `step "${record.name}"` : `step ${index + 1}`;
    if (mappingProblem(record.env)) sites.push(`${label} env is not an object`);
    else if (envSetsFlag(record.env)) sites.push(`${label} env`);
    if (typeof record.run === "string" && shellSetsFlag(record.run)) {
      sites.push(`${label} run script`);
    }
    if (record.with && typeof record.with === "object" && !Array.isArray(record.with)) {
      for (const [key, value] of Object.entries(record.with)) {
        if (typeof value === "string" && shellSetsFlag(value)) {
          sites.push(`${label} with.${key}`);
        }
      }
    }
  });
  return sites;
}

/**
 * An unreadable env block on a job that also builds is treated as the flag
 * being set, so a malformed workflow cannot hide the variable.
 * @param {unknown} env
 */
function mappingProblem(env) {
  return (
    env !== undefined && env !== null && (typeof env !== "object" || Array.isArray(env))
  );
}

/**
 * @param {unknown} env
 */
function envSetsFlag(env) {
  if (!env || typeof env !== "object" || Array.isArray(env)) return false;
  return Object.prototype.hasOwnProperty.call(env, FLAG);
}

/**
 * @param {string} script
 */
function shellSetsFlag(script) {
  for (const line of script.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;
    if (/(?:^|[\s;&|{(])(?:export\s+)?EXPO_PUBLIC_PARITY\s*=/.test(trimmed))
      return true;
  }
  return false;
}

/**
 * @param {Record<string, unknown>} job
 */
function easInvocationsInJob(job) {
  if (job.steps === undefined || job.steps === null) {
    return { commands: invocationsInValue(job), error: "" };
  }
  if (!Array.isArray(job.steps)) {
    return { commands: [], error: '"steps" is not a list' };
  }
  /** @type {{ kind: string, command: string }[]} */
  const commands = [];
  for (let index = 0; index < job.steps.length; index += 1) {
    const step = job.steps[index];
    if (!step || typeof step !== "object" || Array.isArray(step)) {
      if (typeof step === "string" && easInvocations(step).length > 0) {
        commands.push(...easInvocations(step));
      } else if (step !== null && typeof step !== "object") {
        return { commands: [], error: `step ${index + 1} is not a mapping` };
      }
      continue;
    }
    commands.push(...invocationsInValue(step));
  }
  return { commands, error: "" };
}

/**
 * @param {unknown} value
 * @returns {{ kind: string, command: string }[]}
 */
function invocationsInValue(value) {
  if (typeof value === "string") return easInvocations(value);
  if (Array.isArray(value)) return value.flatMap((entry) => invocationsInValue(entry));
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((entry) => invocationsInValue(entry));
}

/**
 * @param {string} script
 * @returns {{ kind: string, command: string }[]}
 */
function easInvocations(script) {
  /** @type {{ kind: string, command: string }[]} */
  const found = [];
  for (const line of logicalShellLines(script)) {
    const re = /\beas(?:-cli)?\s+(build|submit)(?![:\w-])/g;
    let match;
    while ((match = re.exec(line))) {
      const rest = line.slice(match.index);
      const command = rest
        .split(/\s*(?:&&|\|\|)\s*/)[0]
        .split(";")[0]
        .trim();
      found.push({ kind: match[1], command });
    }
  }
  return found;
}

/**
 * @param {string} script
 * @returns {string[]}
 */
function logicalShellLines(script) {
  /** @type {string[]} */
  const lines = [];
  let buffer = "";
  for (const raw of script.split("\n")) {
    const trimmed = raw.trim();
    if (!buffer && (trimmed === "" || trimmed.startsWith("#"))) continue;
    const piece = raw.replace(/\s+$/, "");
    const continued = piece.trimEnd().endsWith("\\");
    const fragment = continued ? piece.trimEnd().slice(0, -1) : piece;
    buffer = `${buffer} ${fragment.trim()}`.trim();
    if (continued) continue;
    if (buffer) lines.push(buffer);
    buffer = "";
  }
  if (buffer) lines.push(buffer);
  return lines;
}

/**
 * @param {{ kind: string, command: string }} command
 * @param {Record<string, unknown>} job
 * @returns {{ name: string, defaulted: boolean, unknown: boolean, raw: string }[]}
 */
function profilesForCommand(command, job) {
  const re =
    /--profile(?:\s*=\s*|\s+)(?:"([^"]*)"|'([^']*)'|(\$\{\{[\s\S]*?\}\})|([^\s"']+))/g;
  /** @type {string | null} */
  let explicit = null;
  let match;
  while ((match = re.exec(command.command))) {
    explicit = match[1] ?? match[2] ?? match[3] ?? match[4];
  }
  if (explicit === null) {
    if (/--profile\b/.test(command.command)) {
      return [{ name: "", defaulted: false, unknown: true, raw: "--profile" }];
    }
    return [{ name: "production", defaulted: true, unknown: false, raw: "production" }];
  }
  const matrixKey = /^\$\{\{\s*matrix\.([A-Za-z0-9_-]+)\s*\}\}$/.exec(explicit.trim());
  if (matrixKey) {
    const values = matrixValues(job, matrixKey[1]);
    if (!values) {
      return [{ name: "", defaulted: false, unknown: true, raw: explicit }];
    }
    return values.map((name) => ({
      name,
      defaulted: false,
      unknown: false,
      raw: explicit,
    }));
  }
  if (explicit.includes("${{")) {
    return [{ name: "", defaulted: false, unknown: true, raw: explicit }];
  }
  return [{ name: explicit.trim(), defaulted: false, unknown: false, raw: explicit }];
}

/**
 * @param {Record<string, unknown>} job
 * @param {string} key
 * @returns {string[] | null}
 */
function matrixValues(job, key) {
  const strategy = job.strategy;
  if (!strategy || typeof strategy !== "object" || Array.isArray(strategy)) return null;
  const matrix = /** @type {{ matrix?: unknown }} */ (strategy).matrix;
  if (!matrix || typeof matrix !== "object" || Array.isArray(matrix)) return null;
  const record = /** @type {Record<string, unknown>} */ (matrix);
  /** @type {Set<string>} */
  const values = new Set();
  const direct = record[key];
  if (Array.isArray(direct)) {
    for (const entry of direct) {
      if (entry !== null && entry !== undefined && typeof entry !== "object") {
        values.add(String(entry));
      }
    }
  } else if (typeof direct === "string" || typeof direct === "number") {
    values.add(String(direct));
  }
  if (Array.isArray(record.include)) {
    for (const row of record.include) {
      if (!row || typeof row !== "object" || Array.isArray(row)) continue;
      const value = /** @type {Record<string, unknown>} */ (row)[key];
      if (typeof value === "string" || typeof value === "number")
        values.add(String(value));
    }
  }
  return values.size > 0 ? [...values] : null;
}

/**
 * @param {string} jobId
 * @param {Record<string, unknown>} job
 */
function formatJob(jobId, job) {
  if (typeof job.name === "string" && job.name !== jobId)
    return `"${jobId}" (${job.name})`;
  return `"${jobId}"`;
}

/**
 * @param {Record<string, unknown>} doc
 */
function documentRunsEas(doc) {
  return invocationsInValue(doc).length > 0;
}

/**
 * GitHub Actions subset: mappings, sequences, plain and quoted scalars, flow
 * collections, and block scalars. Anchors and merge keys throw so a job cannot
 * be skipped because the scanner did not understand it.
 * @param {string} text
 * @param {string} file
 */
export function parseWorkflowYaml(text, file) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n");
  let index = 0;

  function fail(message) {
    throw new ScanError(`${file}:${index + 1}: ${message}`);
  }

  function lineInfo(line) {
    const match = /^([ ]*)([\s\S]*)$/.exec(line);
    const indent = match?.[1].length ?? 0;
    const body = match?.[2] ?? "";
    if (body.startsWith("\t")) fail("tab indentation is not supported");
    return { indent, body };
  }

  function isSkippable(body) {
    return body === "" || body.startsWith("#");
  }

  function skipEmpty() {
    while (index < lines.length) {
      const { body } = lineInfo(lines[index]);
      if (body === "---" || body === "...") {
        index += 1;
        continue;
      }
      if (!isSkippable(body)) return;
      index += 1;
    }
  }

  function parseDocument() {
    skipEmpty();
    if (index >= lines.length) return {};
    const { indent, body } = lineInfo(lines[index]);
    if (body === "-" || body.startsWith("- ")) return parseSequence(indent);
    return parseMapping(indent);
  }

  function parseMapping(indent) {
    /** @type {Record<string, unknown>} */
    const obj = {};
    while (index < lines.length) {
      skipEmpty();
      if (index >= lines.length) break;
      const { indent: keyIndent, body } = lineInfo(lines[index]);
      if (keyIndent < indent) break;
      if (body === "-" || body.startsWith("- ")) break;
      if (keyIndent > indent)
        fail(`unexpected indent in mapping (${JSON.stringify(body)})`);
      const split = splitKey(body);
      if (!split) fail(`expected a mapping key, saw ${JSON.stringify(body)}`);
      if (split.key === "<<" || split.key.includes("&") || split.key.includes("*")) {
        fail("anchors, aliases, and merge keys are not supported");
      }
      index += 1;
      obj[split.key] = parseValueAfterKey(keyIndent, split.rest);
    }
    return obj;
  }

  function parseSequence(indent) {
    /** @type {unknown[]} */
    const items = [];
    while (index < lines.length) {
      skipEmpty();
      if (index >= lines.length) break;
      const { indent: dashIndent, body } = lineInfo(lines[index]);
      if (dashIndent < indent) break;
      if (dashIndent !== indent || !(body === "-" || body.startsWith("- "))) break;
      const rest = body === "-" ? "" : body.slice(2);
      index += 1;
      if (rest === "") {
        items.push(parseNode(dashIndent + 1));
        continue;
      }
      if (isBlockHeader(rest)) {
        items.push(parseBlock(dashIndent, rest));
        continue;
      }
      const split = splitKey(rest);
      if (split && isPlainKey(split.key) && !split.rest.startsWith("//")) {
        const keyColumn = dashIndent + 2;
        /** @type {Record<string, unknown>} */
        const item = {};
        item[split.key] = parseValueAfterKey(keyColumn, split.rest);
        Object.assign(item, parseMapping(keyColumn));
        items.push(item);
        continue;
      }
      items.push(parseScalar(rest));
    }
    return items;
  }

  function parseNode(minIndent) {
    skipEmpty();
    if (index >= lines.length) return null;
    const { indent, body } = lineInfo(lines[index]);
    if (indent < minIndent) return null;
    if (body === "-" || body.startsWith("- ")) return parseSequence(indent);
    return parseMapping(indent);
  }

  /**
   * @param {number} keyIndent
   * @param {string} rest
   */
  function parseValueAfterKey(keyIndent, rest) {
    if (isBlockHeader(rest)) return parseBlock(keyIndent, rest);
    if (rest !== "") {
      if (rest.startsWith("*")) fail("aliases are not supported");
      if (rest.startsWith("[") || rest.startsWith("{")) return parseFlow(rest);
      return parseScalar(rest);
    }
    skipEmpty();
    if (index >= lines.length) return null;
    const { indent, body } = lineInfo(lines[index]);
    if (indent <= keyIndent) return null;
    if (body === "-" || body.startsWith("- ")) return parseSequence(indent);
    return parseMapping(indent);
  }

  /**
   * @param {number} keyIndent
   * @param {string} header
   */
  function parseBlock(keyIndent, header) {
    if (!/^[|>][+-]?$/.test(header))
      fail(`unsupported block scalar ${JSON.stringify(header)}`);
    const chomp = header.includes("+")
      ? "keep"
      : header.includes("-")
        ? "strip"
        : "clip";
    /** @type {string[]} */
    const content = [];
    /** @type {number | null} */
    let contentIndent = null;
    while (index < lines.length) {
      const line = lines[index];
      if (line.trim() === "") {
        content.push("");
        index += 1;
        continue;
      }
      const info = lineInfo(line);
      if (contentIndent === null) {
        if (info.indent <= keyIndent) break;
        contentIndent = info.indent;
      }
      if (info.indent < contentIndent) break;
      content.push(line.slice(contentIndent));
      index += 1;
    }
    while (content.length > 0 && content[content.length - 1] === "") content.pop();
    let text = content.join("\n");
    if (chomp === "clip" && text !== "") text += "\n";
    if (chomp === "keep") text += "\n";
    return text;
  }

  /**
   * @param {string} body
   */
  function splitKey(body) {
    if (body.startsWith('"') || body.startsWith("'")) {
      const quote = body[0];
      let cursor = 1;
      while (cursor < body.length) {
        if (quote === "'" && body[cursor] === "'" && body[cursor + 1] === "'") {
          cursor += 2;
          continue;
        }
        if (quote === '"' && body[cursor] === "\\") {
          cursor += 2;
          continue;
        }
        if (body[cursor] === quote) break;
        cursor += 1;
      }
      if (body[cursor] !== quote)
        fail(`unterminated quoted key ${JSON.stringify(body)}`);
      const key = String(parseScalar(body.slice(0, cursor + 1)));
      const after = body.slice(cursor + 1).trim();
      if (!after.startsWith(":")) return null;
      return { key, rest: stripInlineComment(after.slice(1)).trim() };
    }
    const match = /^([A-Za-z0-9_-]+)\s*:\s*([\s\S]*)$/.exec(body);
    if (!match) return null;
    return { key: match[1], rest: stripInlineComment(match[2]).trim() };
  }

  /**
   * @param {string} key
   */
  function isPlainKey(key) {
    return /^[A-Za-z0-9_-]+$/.test(key);
  }

  /**
   * @param {string} rest
   */
  function isBlockHeader(rest) {
    return /^[|>][+-]?$/.test(rest);
  }

  /**
   * @param {string} textValue
   */
  function parseScalar(textValue) {
    const value = stripInlineComment(textValue).trim();
    if (value === "" || value === "~" || value === "null")
      return value === "" ? "" : null;
    if (value.startsWith('"') || value.startsWith("'")) return unquote(value);
    if (value.startsWith("*")) fail("aliases are not supported");
    return value;
  }

  /**
   * @param {string} value
   */
  function unquote(value) {
    const quote = value[0];
    if (value.length < 2 || value[value.length - 1] !== quote) {
      fail(`unterminated string ${JSON.stringify(value)}`);
    }
    const inner = value.slice(1, -1);
    if (quote === "'") return inner.replace(/''/g, "'");
    return inner
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, "\\");
  }

  /**
   * @param {string} textValue
   */
  function stripInlineComment(textValue) {
    /** @type {string | null} */
    let quote = null;
    for (let cursor = 0; cursor < textValue.length; cursor += 1) {
      const char = textValue[cursor];
      if (quote) {
        if (quote === "'" && char === "'" && textValue[cursor + 1] === "'") {
          cursor += 1;
          continue;
        }
        if (quote === '"' && char === "\\") {
          cursor += 1;
          continue;
        }
        if (char === quote) quote = null;
        continue;
      }
      if (char === '"' || char === "'") {
        quote = char;
        continue;
      }
      if (char === "#" && (cursor === 0 || textValue[cursor - 1] === " ")) {
        return textValue.slice(0, cursor).trimEnd();
      }
    }
    return textValue.trimEnd();
  }

  /**
   * @param {string} textValue
   */
  function parseFlow(textValue) {
    const src = stripInlineComment(textValue).trim();
    let cursor = 0;
    function skipWs() {
      while (src[cursor] === " " || src[cursor] === "\t") cursor += 1;
    }
    function failFlow(message) {
      fail(`${message} in ${JSON.stringify(src)}`);
    }
    function parseQuotedFlow() {
      const quote = src[cursor];
      let end = cursor + 1;
      while (end < src.length) {
        if (quote === "'" && src[end] === "'" && src[end + 1] === "'") {
          end += 2;
          continue;
        }
        if (quote === '"' && src[end] === "\\") {
          end += 2;
          continue;
        }
        if (src[end] === quote) break;
        end += 1;
      }
      if (src[end] !== quote) failFlow("unterminated string");
      const raw = src.slice(cursor, end + 1);
      cursor = end + 1;
      return unquote(raw);
    }
    function parseValue() {
      skipWs();
      if (src[cursor] === "[") return parseSeq();
      if (src[cursor] === "{") return parseMap();
      if (src[cursor] === '"' || src[cursor] === "'") return parseQuotedFlow();
      const start = cursor;
      while (
        cursor < src.length &&
        src[cursor] !== "," &&
        src[cursor] !== "]" &&
        src[cursor] !== "}"
      ) {
        cursor += 1;
      }
      const raw = src.slice(start, cursor).trim();
      if (raw === "~" || raw === "null") return null;
      return raw;
    }
    function parseSeq() {
      cursor += 1;
      /** @type {unknown[]} */
      const list = [];
      skipWs();
      if (src[cursor] === "]") {
        cursor += 1;
        return list;
      }
      while (cursor < src.length) {
        list.push(parseValue());
        skipWs();
        if (src[cursor] === ",") {
          cursor += 1;
          continue;
        }
        if (src[cursor] === "]") {
          cursor += 1;
          return list;
        }
        failFlow("broken flow sequence");
      }
      failFlow("unterminated flow sequence");
      return list;
    }
    function parseMap() {
      cursor += 1;
      /** @type {Record<string, unknown>} */
      const obj = {};
      skipWs();
      if (src[cursor] === "}") {
        cursor += 1;
        return obj;
      }
      while (cursor < src.length) {
        skipWs();
        let key = "";
        if (src[cursor] === '"' || src[cursor] === "'") key = String(parseQuotedFlow());
        else {
          const start = cursor;
          while (
            cursor < src.length &&
            src[cursor] !== ":" &&
            src[cursor] !== "}" &&
            src[cursor] !== ","
          ) {
            cursor += 1;
          }
          key = src.slice(start, cursor).trim();
        }
        skipWs();
        if (src[cursor] !== ":") failFlow("broken flow mapping");
        cursor += 1;
        if (key === "<<") fail("merge keys are not supported");
        obj[key] = parseValue();
        skipWs();
        if (src[cursor] === ",") {
          cursor += 1;
          continue;
        }
        if (src[cursor] === "}") {
          cursor += 1;
          return obj;
        }
        failFlow("broken flow mapping");
      }
      failFlow("unterminated flow mapping");
      return obj;
    }
    if (!(src.startsWith("[") || src.startsWith("{")))
      failFlow("expected a flow collection");
    if (!src.endsWith(src.startsWith("[") ? "]" : "}")) {
      fail("multiline flow collections are not supported");
    }
    const value = src.startsWith("[") ? parseSeq() : parseMap();
    skipWs();
    if (cursor !== src.length) failFlow("trailing data");
    return value;
  }

  return parseDocument();
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function countStringRuns(value) {
  if (typeof value === "string") return 0;
  if (Array.isArray(value))
    return value.reduce((sum, entry) => sum + countStringRuns(entry), 0);
  if (!value || typeof value !== "object") return 0;
  let count = 0;
  for (const [key, entry] of Object.entries(value)) {
    if (key === "run" && typeof entry === "string") count += 1;
    count += countStringRuns(entry);
  }
  return count;
}

/**
 * @param {string} text
 */
function countRunKeyLines(text) {
  return text.split("\n").filter((line) => {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) return false;
    return /^-+\s+run:/.test(trimmed) || /^run:/.test(trimmed);
  }).length;
}

function runSelfTest() {
  /** @type {string[]} */
  const failures = [];
  let passed = 0;

  /**
   * @param {string} name
   * @param {() => void} fn
   */
  function check(name, fn) {
    try {
      fn();
      passed += 1;
      console.log(`✓ ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`✗ ${name}`);
      console.error(error instanceof Error ? (error.stack ?? error.message) : error);
    }
  }

  const clean = {
    build: {
      base: { env: { EXPO_PUBLIC_API_URL: "http://localhost:3000" } },
      development: {
        extends: "base",
        env: { EXPO_PUBLIC_PARITY: "1" },
      },
      preview: {
        extends: "base",
        env: { EXPO_PUBLIC_API_URL: "https://www.chess-school.in" },
      },
      production: { extends: "preview" },
      qa: {
        extends: "preview",
        env: { EXPO_PUBLIC_SENTRY_DSN: "https://example.invalid" },
      },
    },
  };

  check("clean eas.json passes", () => {
    const errors = checkEasConfig(clean, "apps/mobile/eas.json");
    assert.deepEqual(errors, []);
  });

  check("production with the flag fails", () => {
    const errors = checkEasConfig(
      {
        build: {
          production: { env: { EXPO_PUBLIC_PARITY: "1" } },
          preview: { env: {} },
        },
      },
      "apps/mobile/eas.json",
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /apps\/mobile\/eas\.json/);
    assert.match(errors[0], /build profile "production"/);
    assert.match(errors[0], /EXPO_PUBLIC_PARITY/);
    assert.match(errors[0], /"1"/);
  });

  check("production flag of any value fails", () => {
    for (const value of ["", "0", "false", 1]) {
      const errors = checkEasConfig(
        { build: { production: { env: { EXPO_PUBLIC_PARITY: value } } } },
        "apps/mobile/eas.json",
      );
      assert.equal(errors.length, 1, JSON.stringify(value));
      assert.match(errors[0], /profile "production"/);
    }
  });

  check("preview with the flag fails", () => {
    const errors = checkEasConfig(
      { build: { preview: { env: { EXPO_PUBLIC_PARITY: "1" } } } },
      "apps/mobile/eas.json",
    );
    assert.match(errors[0], /profile "preview"/);
    assert.match(errors[0], /apps\/mobile\/eas\.json/);
  });

  check("profile that extends production with the flag fails", () => {
    const errors = checkEasConfig(
      {
        build: {
          production: { env: { EXPO_PUBLIC_API_URL: "https://www.chess-school.in" } },
          "store-internal": {
            extends: "production",
            env: { EXPO_PUBLIC_PARITY: "1" },
          },
        },
      },
      "apps/mobile/eas.json",
    );
    assert.ok(errors.some((error) => error.includes('profile "store-internal"')));
    assert.ok(errors.some((error) => error.includes('extends "production"')));
    assert.ok(errors.every((error) => !error.includes('profile "production" sets')));
  });

  check("profile that extends production through another profile fails", () => {
    const errors = checkEasConfig(
      {
        build: {
          production: { env: {} },
          mid: { extends: "production" },
          leaf: { extends: "mid", env: { EXPO_PUBLIC_PARITY: "yes" } },
        },
      },
      "apps/mobile/eas.json",
    );
    assert.equal(errors.length, 1);
    assert.match(errors[0], /profile "leaf"/);
    assert.match(errors[0], /extends "production"/);
  });

  check("production inherits the flag through extends", () => {
    const errors = checkEasConfig(
      {
        build: {
          base: { env: { EXPO_PUBLIC_PARITY: "1" } },
          shared: { extends: "base" },
          production: { extends: "shared" },
        },
      },
      "apps/mobile/eas.json",
    );
    assert.ok(errors.some((error) => /profile "production"/.test(error)));
    assert.ok(errors.some((error) => error.includes('inherited from "base"')));
  });

  check("extends cycle names the profile and file", () => {
    const errors = checkEasConfig(
      {
        build: {
          production: { extends: "preview" },
          preview: { extends: "production", env: { EXPO_PUBLIC_PARITY: "1" } },
        },
      },
      "apps/mobile/eas.json",
    );
    assert.ok(errors.length >= 1);
    assert.ok(errors.every((error) => error.includes("apps/mobile/eas.json")));
    assert.ok(errors.some((error) => error.includes("extends cycle")));
  });

  const releaseWorkflow = `
name: Release
on:
  workflow_dispatch:
jobs:
  ship:
    name: Ship Android
    runs-on: ubuntu-latest
    env:
      EXPO_PUBLIC_PARITY: "1"
    steps:
      - name: Build
        run: npx eas-cli build --platform android --profile production --non-interactive
`;

  check("workflow running eas build with the flag fails", () => {
    const errors = checkWorkflowYaml(releaseWorkflow, ".github/workflows/release.yml");
    assert.ok(errors.length >= 1);
    assert.ok(errors.some((error) => error.includes(".github/workflows/release.yml")));
    assert.ok(errors.some((error) => error.includes('job "ship"')));
    assert.ok(errors.some((error) => error.includes("EXPO_PUBLIC_PARITY")));
    assert.ok(errors.some((error) => error.includes("eas build")));
    assert.ok(errors.some((error) => error.includes('profile "production"')));
  });

  check("eas submit preview with an inline flag fails", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  submit:
    steps:
      - name: Submit
        run: EXPO_PUBLIC_PARITY=1 npx eas submit --profile preview --non-interactive
`,
      ".github/workflows/submit.yml",
    );
    assert.match(errors.join("\n"), /job "submit"/);
    assert.match(errors.join("\n"), /eas submit/);
    assert.match(errors.join("\n"), /profile "preview"/);
    assert.match(errors.join("\n"), /\.github\/workflows\/submit\.yml/);
  });

  check("eas build without --profile defaults to production", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  ship:
    steps:
      - run: eas build --platform android
        env:
          EXPO_PUBLIC_PARITY: "1"
`,
      ".github/workflows/release.yml",
    );
    assert.match(errors.join("\n"), /profile "production"/);
    assert.match(errors.join("\n"), /default when --profile is omitted/);
  });

  check("development eas build may set the flag", () => {
    const errors = checkWorkflowYaml(
      `
env:
  EXPO_PUBLIC_PARITY: "1"
jobs:
  parity:
    steps:
      - run: npx eas-cli build --profile development
`,
      ".github/workflows/parity.yml",
    );
    assert.deepEqual(errors, []);
  });

  check("a job that does not run eas may set the flag", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  parity:
    env:
      EXPO_PUBLIC_PARITY: "1"
    steps:
      - run: echo parity
  ship:
    steps:
      - run: npx eas-cli build --profile production
`,
      ".github/workflows/release.yml",
    );
    assert.deepEqual(errors, []);
  });

  check("continued eas build lines are visible", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  ship:
    steps:
      - run: |
          npx eas-cli build \\
            --platform android \\
            --profile production \\
            --non-interactive
        env:
          EXPO_PUBLIC_PARITY: "0"
`,
      ".github/workflows/release.yml",
    );
    assert.match(errors.join("\n"), /profile "production"/);
  });

  check("matrix profile production fails", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  ship:
    strategy:
      matrix:
        profile: [development, production]
    steps:
      - run: eas build --profile \${{ matrix.profile }}
        env:
          EXPO_PUBLIC_PARITY: "1"
`,
      ".github/workflows/release.yml",
    );
    assert.match(errors.join("\n"), /profile "production"/);
    assert.doesNotMatch(errors.join("\n"), /profile "development"/);
  });

  check("play-store screenshots may set the flag when they do not run eas", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  capture:
    name: Android emulator screenshots
    env:
      EXPO_PUBLIC_PARITY: "1"
    steps:
      - name: Build release APK
        run: ./gradlew :app:assembleRelease
`,
      SCREENSHOT_WORKFLOW,
    );
    assert.deepEqual(errors, []);
  });

  check("play-store screenshots lose the exception once they run eas", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  capture:
    env:
      EXPO_PUBLIC_PARITY: "1"
    steps:
      - run: eas build --profile production
`,
      SCREENSHOT_WORKFLOW,
    );
    assert.match(errors.join("\n"), /play-store-screenshots\.yml/);
    assert.match(errors.join("\n"), /job "capture"/);
    assert.match(errors.join("\n"), /profile "production"/);
  });

  check("comments do not count as eas build or the flag", () => {
    const errors = checkWorkflowYaml(
      `
jobs:
  ship:
    steps:
      - run: |
          # EXPO_PUBLIC_PARITY=1 eas build --profile production
          echo ok
`,
      ".github/workflows/release.yml",
    );
    assert.deepEqual(errors, []);
  });

  check("current workflows parse and the repo passes", () => {
    const workflowDir = path.join(ROOT, ".github/workflows");
    const files = fs
      .readdirSync(workflowDir)
      .filter((name) => name.endsWith(".yml"))
      .sort();
    assert.ok(files.length >= 1);
    for (const name of files) {
      const rel = `.github/workflows/${name}`;
      const text = fs.readFileSync(path.join(workflowDir, name), "utf8");
      const doc = parseWorkflowYaml(text, rel);
      assert.equal(countStringRuns(doc), countRunKeyLines(text), rel);
    }
    const errors = checkRepository(ROOT);
    assert.deepEqual(errors, []);
  });

  if (failures.length > 0) {
    console.error(`\n✗ self-test failed (${failures.length}): ${failures.join(", ")}`);
    return false;
  }
  console.log(`\n✓ self-test passed (${passed})`);
  return true;
}

function main() {
  if (process.argv.includes("--self-test")) {
    process.exit(runSelfTest() ? 0 : 1);
  }
  const errors = checkRepository(ROOT);
  if (errors.length > 0) {
    for (const error of errors) console.error(`✗ ${error}`);
    console.error(
      `✗ EXPO_PUBLIC_PARITY must not be set on production or preview store builds (${errors.length})`,
    );
    process.exit(1);
  }
  console.log("✓ No EXPO_PUBLIC_PARITY in production or preview builds");
}

const isDirect =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) main();
