#!/usr/bin/env node
/**
 * Fail when a store-bound build can bake EXPO_PUBLIC_PARITY into the app.
 *
 * apps/mobile login auto-submits a deep-link password when that flag is "1".
 * production, preview, and any build profile whose extends chain reaches them
 * must not set it (including a value inherited from a parent profile).
 *
 * Workflow files must not mention the flag at all. The one exception is
 * .github/workflows/play-store-screenshots.yml (emulator capture, PR #53),
 * and only while that file contains neither `eas build` nor `eas submit`.
 *
 *   node scripts/check-no-parity-in-store-builds.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const FLAG = "EXPO_PUBLIC_PARITY";
const STORE = new Set(["production", "preview"]);
const SCREENSHOTS = ".github/workflows/play-store-screenshots.yml";
const EAS_CMD = /\beas(?:-cli)?\s+(build|submit)\b/;
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * @param {unknown} eas
 * @param {string} [file]
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
  const profiles = /** @type {Record<string, { extends?: unknown; env?: unknown }>} */ (
    build
  );
  /** @type {string[]} */
  const errors = [];
  for (const name of Object.keys(profiles)) {
    const store = storeRoot(profiles, name);
    if (!store) continue;
    const resolved = resolveEnv(profiles, name);
    if (resolved.error) {
      errors.push(`${file}: build profile "${name}": ${resolved.error}`);
      continue;
    }
    if (!Object.prototype.hasOwnProperty.call(resolved.env, FLAG)) continue;
    /** @type {string[]} */
    const notes = [];
    if (resolved.sources[FLAG] !== name)
      notes.push(`inherited from "${resolved.sources[FLAG]}"`);
    if (store !== name) notes.push(`extends "${store}"`);
    const suffix = notes.length ? ` (${notes.join(", ")})` : "";
    errors.push(
      `${file}: build profile "${name}" sets ${FLAG} to ${JSON.stringify(resolved.env[FLAG])}${suffix}`,
    );
  }
  return errors;
}

/**
 * Line scan. No YAML parser is resolvable from the repo root.
 * @param {string} text
 * @param {string} file
 * @returns {string[]}
 */
export function checkWorkflowText(text, file) {
  if (file === SCREENSHOTS) {
    const line = matchingLine(text, EAS_CMD);
    if (line === 0) return [];
    const kind = EAS_CMD.exec(text.split(/\r?\n/)[line - 1])?.[1] ?? "build";
    return [
      `${file}:${line}: contains eas ${kind}, so the parity-flag exception does not apply`,
    ];
  }
  const line = matchingLine(text, new RegExp(FLAG));
  if (line === 0) return [];
  return [`${file}:${line}: mentions ${FLAG}`];
}

/**
 * @param {string} root
 * @returns {string[]}
 */
export function checkRepository(root) {
  const easPath = path.join(root, "apps/mobile/eas.json");
  let eas;
  try {
    eas = JSON.parse(fs.readFileSync(easPath, "utf8"));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return [`apps/mobile/eas.json: cannot read build profiles (${message})`];
  }
  /** @type {string[]} */
  const errors = [...checkEasConfig(eas, "apps/mobile/eas.json")];
  const workflowDir = path.join(root, ".github/workflows");
  if (!fs.existsSync(workflowDir)) return errors;
  for (const name of fs
    .readdirSync(workflowDir)
    .filter((entry) => entry.endsWith(".yml"))
    .sort()) {
    const rel = `.github/workflows/${name}`;
    errors.push(
      ...checkWorkflowText(fs.readFileSync(path.join(workflowDir, name), "utf8"), rel),
    );
  }
  return errors;
}

/**
 * @param {Record<string, { extends?: unknown }>} profiles
 * @param {string} name
 * @param {string[]} [stack]
 * @returns {string | null}
 */
function storeRoot(profiles, name, stack = []) {
  if (STORE.has(name)) return name;
  if (stack.includes(name)) return null;
  const parent = profiles[name]?.extends;
  if (typeof parent !== "string" || parent.trim() === "") return null;
  const next = parent.trim();
  return STORE.has(next) ? next : storeRoot(profiles, next, [...stack, name]);
}

/**
 * @param {Record<string, { extends?: unknown; env?: unknown }>} profiles
 * @param {string} name
 * @param {string[]} [stack]
 * @returns {{ env: Record<string, unknown>, sources: Record<string, string>, error?: string }}
 */
function resolveEnv(profiles, name, stack = []) {
  if (stack.includes(name)) {
    return {
      env: {},
      sources: {},
      error: `extends cycle: ${[...stack, name].join(" -> ")}`,
    };
  }
  const profile = profiles[name];
  if (!profile || typeof profile !== "object" || Array.isArray(profile)) {
    return { env: {}, sources: {}, error: `missing profile "${name}"` };
  }
  /** @type {Record<string, unknown>} */
  let env = {};
  /** @type {Record<string, string>} */
  let sources = {};
  if (profile.extends !== undefined) {
    if (typeof profile.extends !== "string" || profile.extends.trim() === "") {
      return {
        env,
        sources,
        error: `invalid extends value ${JSON.stringify(profile.extends)}`,
      };
    }
    const parentName = profile.extends.trim();
    const parent = resolveEnv(profiles, parentName, [...stack, name]);
    if (parent.error) {
      return { env, sources, error: `extends "${parentName}": ${parent.error}` };
    }
    env = { ...parent.env };
    sources = { ...parent.sources };
  }
  if (profile.env !== undefined) {
    if (!profile.env || typeof profile.env !== "object" || Array.isArray(profile.env)) {
      return { env: {}, sources: {}, error: "env is not an object" };
    }
    for (const [key, value] of Object.entries(profile.env)) {
      env[key] = value;
      sources[key] = name;
    }
  }
  return { env, sources };
}

/**
 * @param {string} text
 * @param {RegExp} pattern
 */
function matchingLine(text, pattern) {
  const lines = text.split(/\r?\n/);
  const index = lines.findIndex((line) => pattern.test(line));
  return index + 1;
}

function main() {
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
