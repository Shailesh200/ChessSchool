#!/usr/bin/env node
/**
 * Fill the store-shot login link in a Maestro flow.
 *
 * Reads STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD from the env file written
 * by db:seed:test-user (apps/web/.store-shot.env). URL-encodes both, masks
 * them, and writes a copy of the flow. The copy stays outside the repo and
 * outside Maestro's output directory.
 *
 * Does not print the values or the link. Stdout is only mask commands and
 * one status line.
 *
 *   node scripts/substitute-store-shot-flow.mjs --self-test
 *   node scripts/substitute-store-shot-flow.mjs \
 *     --env-file apps/web/.store-shot.env \
 *     --flow apps/mobile/maestro/store-shots.yaml \
 *     --out "$RUNNER_TEMP/store-shot-flow.yaml" \
 *     --repo "$GITHUB_WORKSPACE" \
 *     --not-under "$RUNNER_TEMP/maestro-raw"
 */
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EMAIL_TOKEN = "${STORE_SHOT_EMAIL}";
const PASSWORD_TOKEN = "${STORE_SHOT_PASSWORD}";
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const key = argv[i];
    if (!key.startsWith("--")) throw new Error("Unexpected argument.");
    const name = key.slice(2);
    const value = argv[++i];
    if (value == null || value.startsWith("--")) throw new Error(`Missing value for --${name}.`);
    out[name] = value;
  }
  return out;
}

function parseEnvFile(text) {
  const found = {};
  for (const rawLine of text.split(/\n/)) {
    const line = rawLine.replace(/\r$/, "");
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^(?:export\s+)?(STORE_SHOT_EMAIL|STORE_SHOT_PASSWORD)=(.*)$/.exec(trimmed);
    if (!match) continue;
    let value = match[2];
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    ) {
      value = value.slice(1, -1);
    }
    found[match[1]] = value;
  }
  return found;
}

function credentialsFromEnvText(text) {
  const found = parseEnvFile(text);
  const email = found.STORE_SHOT_EMAIL;
  const password = found.STORE_SHOT_PASSWORD;
  if (!email || !password) {
    throw new Error("Store-shot env file is missing STORE_SHOT_EMAIL or STORE_SHOT_PASSWORD.");
  }
  if (/[\r\n]/.test(email) || /[\r\n]/.test(password)) {
    throw new Error("Store-shot credentials must be a single line.");
  }
  return { email, password };
}

function substituteFlow(flowText, email, password) {
  const hasEmail = flowText.includes(EMAIL_TOKEN);
  const hasPassword = flowText.includes(PASSWORD_TOKEN);
  if (!hasEmail && !hasPassword) return null;
  if (!hasEmail || !hasPassword) {
    throw new Error("Store-shot flow is missing one login placeholder.");
  }
  const encEmail = encodeURIComponent(email);
  const encPassword = encodeURIComponent(password);
  const next = flowText.split(EMAIL_TOKEN).join(encEmail).split(PASSWORD_TOKEN).join(encPassword);
  if (next.includes(EMAIL_TOKEN) || next.includes(PASSWORD_TOKEN)) {
    throw new Error("Store-shot placeholders were not fully substituted.");
  }
  if (email !== encEmail && next.includes(email)) {
    throw new Error("Refusing to write a raw store-shot email.");
  }
  if (password !== encPassword && next.includes(password)) {
    throw new Error("Refusing to write a raw store-shot password.");
  }
  const link = `chessschool:///login?email=${encEmail}&password=${encPassword}`;
  if (!next.includes(link)) {
    throw new Error("Substituted flow is missing the login link.");
  }
  return { text: next, email, password, encEmail, encPassword, link };
}

function isInside(parent, target) {
  const rel = relative(resolve(parent), resolve(target));
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function assertSafeOutput(outPath, repo, notUnder) {
  const out = resolve(outPath);
  if (repo && isInside(repo, out)) {
    throw new Error("Refusing to write the substituted flow inside the repo.");
  }
  if (notUnder && isInside(notUnder, out)) {
    throw new Error("Refusing to write the substituted flow into the Maestro output directory.");
  }
}

function mask(value) {
  const escaped = String(value).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  process.stdout.write(`::add-mask::${escaped}\n`);
}

function writeFlow(outPath, text) {
  mkdirSync(dirname(outPath), { recursive: true, mode: 0o700 });
  rmSync(outPath, { force: true });
  writeFileSync(outPath, text, { mode: 0o600, flag: "wx" });
  chmodSync(outPath, 0o600);
  const mode = statSync(outPath).mode & 0o777;
  if (mode !== 0o600) {
    throw new Error("Substituted flow was not mode 600.");
  }
}

function run(argv) {
  const args = parseArgs(argv);
  for (const name of ["env-file", "flow", "out", "repo", "not-under"]) {
    if (!args[name]) throw new Error(`Missing --${name}.`);
  }
  assertSafeOutput(args.out, args.repo, args["not-under"]);
  const flowText = readFileSync(args.flow, "utf8");
  const { email, password } = credentialsFromEnvText(readFileSync(args["env-file"], "utf8"));
  const substituted = substituteFlow(flowText, email, password);
  if (!substituted) {
    process.stdout.write("No store-shot placeholders in the Maestro flow.\n");
    process.exit(2);
  }
  mask(substituted.email);
  mask(substituted.password);
  mask(substituted.encEmail);
  mask(substituted.encPassword);
  mask(substituted.link);
  writeFlow(args.out, substituted.text);
  process.stdout.write("✓ substituted store-shot flow\n");
}

function assertNoCredentialLeak(output, email, password) {
  for (const line of output.split("\n")) {
    if (line.startsWith("::add-mask::")) continue;
    if (line.includes(email) || line.includes(password) || line.includes(encodeURIComponent(password))) {
      throw new Error("substitution printed a credential");
    }
  }
}

function selfTest() {
  const email = "student+shot@example.com";
  const password = "a%b c&d";
  const root = mkdtempSync(resolve(tmpdir(), "store-shot-sub-"));
  const repo = resolve(root, "repo");
  const artifact = resolve(root, "maestro-raw");
  const envFile = resolve(root, ".store-shot.env");
  const flow = resolve(root, "flow.yaml");
  const plainFlow = resolve(root, "plain.yaml");
  const out = resolve(root, "nested", "store-shot-flow.yaml");
  try {
    mkdirSync(repo);
    mkdirSync(artifact);
    writeFileSync(envFile, `# test-only\nexport STORE_SHOT_EMAIL='${email}'\nSTORE_SHOT_PASSWORD="${password}"\n`, {
      mode: 0o600,
    });
    const source = `appId: com.chessschool.app\n---\n- openLink: "chessschool:///login?email=${EMAIL_TOKEN}&password=${PASSWORD_TOKEN}"\n`;
    writeFileSync(flow, source);
    writeFileSync(plainFlow, "appId: com.chessschool.app\n---\n- tapOn:\n    id: orientation-skip\n");

    const child = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--env-file",
        envFile,
        "--flow",
        flow,
        "--out",
        out,
        "--repo",
        repo,
        "--not-under",
        artifact,
      ],
      { encoding: "utf8" },
    );
    if (child.status !== 0) throw new Error("substitution failed");
    assertNoCredentialLeak(`${child.stdout}${child.stderr}`, email, password);
    if (!child.stdout.includes("::add-mask::")) throw new Error("credentials were not masked");
    if (!child.stdout.endsWith("✓ substituted store-shot flow\n")) {
      throw new Error("substitution printed unexpected output");
    }
    const written = readFileSync(out, "utf8");
    const link = `chessschool:///login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`;
    if (!written.includes(link)) throw new Error("encoded login link was not written");
    if (written.includes(EMAIL_TOKEN) || written.includes(PASSWORD_TOKEN)) {
      throw new Error("placeholders remained");
    }
    if (written.includes(password)) throw new Error("raw password was written into the flow");
    if ((statSync(out).mode & 0o777) !== 0o600) throw new Error("flow mode was not 600");

    const skipped = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--env-file",
        envFile,
        "--flow",
        plainFlow,
        "--out",
        resolve(root, "unused.yaml"),
        "--repo",
        repo,
        "--not-under",
        artifact,
      ],
      { encoding: "utf8" },
    );
    if (skipped.status !== 2) throw new Error("flow without placeholders should be skipped");
    assertNoCredentialLeak(`${skipped.stdout}${skipped.stderr}`, email, password);
    if (skipped.stdout.includes("::add-mask::")) throw new Error("unused credentials were masked");

    const insideRepo = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--env-file",
        envFile,
        "--flow",
        flow,
        "--out",
        resolve(repo, "store-shot-flow.yaml"),
        "--repo",
        repo,
        "--not-under",
        artifact,
      ],
      { encoding: "utf8" },
    );
    if (insideRepo.status === 0) throw new Error("write inside the repo was allowed");
    assertNoCredentialLeak(`${insideRepo.stdout}${insideRepo.stderr}`, email, password);

    const insideArtifact = spawnSync(
      process.execPath,
      [
        SCRIPT_PATH,
        "--env-file",
        envFile,
        "--flow",
        flow,
        "--out",
        resolve(artifact, "store-shot-flow.yaml"),
        "--repo",
        repo,
        "--not-under",
        artifact,
      ],
      { encoding: "utf8" },
    );
    if (insideArtifact.status === 0) throw new Error("write into the Maestro output was allowed");
    assertNoCredentialLeak(`${insideArtifact.stdout}${insideArtifact.stderr}`, email, password);

    let leaked = false;
    try {
      credentialsFromEnvText("STORE_SHOT_EMAIL=visible@example.com\n");
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      leaked = message.includes("visible@example.com");
      if (!message.includes("missing")) throw new Error("missing password should fail clearly");
    }
    if (leaked) throw new Error("error included a credential");

    console.log("✓ substitute-store-shot-flow self-test");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

if (process.argv[2] === "--self-test") {
  try {
    selfTest();
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
} else if (process.argv[1] && resolve(process.argv[1]) === SCRIPT_PATH) {
  try {
    run(process.argv.slice(2));
  } catch (err) {
    console.error(`✗ ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }
}
