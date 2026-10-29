import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const repoRoot = path.resolve(__dirname, "../../..");
const mobileRoot = path.resolve(__dirname, "..");

type EasJson = {
  cli: { version: string; appVersionSource: string };
  build: Record<string, Record<string, unknown>>;
  submit: Record<string, unknown>;
};

const eas = JSON.parse(
  readFileSync(path.join(mobileRoot, "eas.json"), "utf8"),
) as EasJson;
const workflow = readFileSync(
  path.join(mobileRoot, ".eas/workflows/qa-sim.yml"),
  "utf8",
);
const guardScript = readFileSync(
  path.join(repoRoot, "scripts/qa-sim-guard.sh"),
  "utf8",
);
const pinScript = path.join(repoRoot, "scripts/qa-sim-pin-commit.sh");
const webScript = readFileSync(path.join(repoRoot, "scripts/qa-sim-web.sh"), "utf8");
const collectScript = readFileSync(
  path.join(repoRoot, "scripts/qa-sim-collect.sh"),
  "utf8",
);
const runner = readFileSync(
  path.join(mobileRoot, ".eas/functions/qa-sim-run/function.yml"),
  "utf8",
);

function markerRegion(text: string): string {
  const start = "# qa-sim-guard:start";
  const end = "# qa-sim-guard:end";
  const hash = text.indexOf(start);
  const endHash = text.indexOf(end);
  expect(hash, "guard start marker").toBeGreaterThanOrEqual(0);
  expect(endHash, "guard end marker").toBeGreaterThan(hash);
  const lineStart = text.lastIndexOf("\n", hash) + 1;
  const endLine = text.indexOf("\n", endHash);
  return text.slice(lineStart, endLine === -1 ? text.length : endLine);
}

function dedent(block: string): string {
  const lines = block.split("\n");
  const widths = lines
    .filter((line) => line.trim().length > 0)
    .map((line) => line.match(/^ */)?.[0].length ?? 0);
  const min = Math.min(...widths);
  return lines
    .map((line) => (line.startsWith(" ".repeat(min)) ? line.slice(min) : line))
    .join("\n");
}

function commandEnv(extra: Record<string, string | undefined> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: "test",
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_AUTHOR_NAME: "QA Sim",
    GIT_AUTHOR_EMAIL: "qa-sim@example.com",
    GIT_COMMITTER_NAME: "QA Sim",
    GIT_COMMITTER_EMAIL: "qa-sim@example.com",
  };
  for (const [key, value] of Object.entries(extra)) {
    if (value !== undefined) env[key] = value;
  }
  return env;
}

function runGuard(extra: Record<string, string | undefined> = {}) {
  return spawnSync("bash", [path.join(repoRoot, "scripts/qa-sim-guard.sh")], {
    env: commandEnv(extra),
    encoding: "utf8",
  });
}

describe("qa-sim build profile", () => {
  it("points each simulator at the local API and leaves the other profiles in place", () => {
    expect(Object.keys(eas.build)).toEqual([
      "development",
      "preview",
      "production",
      "qa-sim",
    ]);
    expect(Object.keys(eas.submit)).toEqual(["production", "play-store"]);
    expect(eas.cli).toEqual({ version: ">= 16.0.0", appVersionSource: "local" });

    const development = eas.build.development!;
    expect(development.channel).toBe("development");
    expect(development.distribution).toBe("internal");
    expect(development.developmentClient).toBe(true);
    expect(
      (development.env as { EXPO_PUBLIC_API_URL: string }).EXPO_PUBLIC_API_URL,
    ).toBe("http://localhost:3000");
    expect((development.ios as { simulator: boolean }).simulator).toBe(true);

    const preview = eas.build.preview!;
    expect(preview.channel).toBe("preview");
    expect((preview.env as { EXPO_PUBLIC_API_URL: string }).EXPO_PUBLIC_API_URL).toBe(
      "https://www.chess-school.in",
    );
    expect((preview.android as { buildType: string }).buildType).toBe("apk");

    const production = eas.build.production!;
    expect(production.channel).toBe("production");
    expect(production.autoIncrement).toBe(true);
    expect(
      (production.env as { EXPO_PUBLIC_API_URL: string }).EXPO_PUBLIC_API_URL,
    ).toBe("https://www.chess-school.in");
    expect((production.android as { buildType: string }).buildType).toBe("app-bundle");

    const qa = eas.build["qa-sim"]!;
    expect(qa.distribution).toBe("internal");
    expect(qa.channel).toBeUndefined();
    expect(qa.env).toBeUndefined();
    expect(qa.developmentClient).toBeUndefined();
    expect(JSON.stringify(qa)).not.toContain("channel");
    expect(eas.submit["qa-sim"]).toBeUndefined();

    const ios = qa.ios as {
      distribution: string;
      simulator: boolean;
      withoutCredentials: boolean;
      env: { EXPO_PUBLIC_API_URL: string };
    };
    const android = qa.android as {
      distribution: string;
      buildType: string;
      env: { EXPO_PUBLIC_API_URL: string };
    };
    expect(ios.simulator).toBe(true);
    expect(ios.distribution).toBe("internal");
    expect(ios.withoutCredentials).toBe(true);
    expect(android.distribution).toBe("internal");
    expect(ios.env.EXPO_PUBLIC_API_URL).toBe("http://localhost:3108");
    expect(android.buildType).toBe("apk");
    expect(android.env.EXPO_PUBLIC_API_URL).toBe("http://10.0.2.2:3108");
  });
});

describe("prod path gates", () => {
  it("keeps Play submit on an internal draft and has no iOS auto-release", () => {
    const production = eas.submit.production as {
      android: { track: string; releaseStatus: string };
      ios?: unknown;
    };
    const playStore = eas.submit["play-store"] as {
      android: { track: string; releaseStatus: string };
      ios?: unknown;
    };
    expect(production.android).toEqual({
      track: "internal",
      releaseStatus: "completed",
    });
    expect(playStore.android).toEqual({ track: "internal", releaseStatus: "draft" });
    expect(production.ios).toBeUndefined();
    expect(playStore.ios).toBeUndefined();
    expect(JSON.stringify(eas.submit)).not.toContain('"ios"');
  });

  it("runs production-API iOS parity only when target_prod is true", () => {
    const yaml = readFileSync(
      path.join(repoRoot, ".github/workflows/parity-ios.yml"),
      "utf8",
    );
    expect(yaml).toContain("target_prod:");
    expect(yaml).toContain("type: boolean");
    expect(yaml).toContain("default: false");
    const job = yaml.slice(yaml.indexOf("  parity-ios-prod:"));
    expect(job.startsWith("  parity-ios-prod:")).toBe(true);
    expect(job.indexOf("if: inputs.target_prod == true")).toBeGreaterThan(0);
    expect(job.indexOf("if: inputs.target_prod == true")).toBeLessThan(
      job.indexOf("runs-on:"),
    );
    expect(yaml).not.toMatch(/\n\s+needs:/);
  });
});

describe("qa-sim workflow", () => {
  it("is manual, builds qa-sim, and uploads Maestro artifacts", () => {
    const header = workflow.slice(0, workflow.indexOf("\njobs:"));
    expect(header).toContain("workflow_dispatch:");
    expect(header).not.toMatch(/\n {2}push:/);
    expect(header).not.toMatch(/\n {2}pull_request:/);
    expect(header).not.toMatch(/\n {2}schedule:/);
    expect(workflow).toContain("profile: qa-sim");
    expect(workflow).toContain("flow_path: ../../parity/maestro/flows/qa");
    expect(workflow).toContain("name: qa-sim-ios-maestro");
    expect(workflow).toContain("name: qa-sim-android-maestro");
    expect(workflow).toContain("type: other");
    expect(workflow).toContain("runs_on: linux-medium-nested-virtualization");
    expect(workflow).toContain("runs_on: macos-medium");
    expect(workflow.indexOf("Fail if Turso")).toBeLessThan(
      workflow.indexOf("type: build"),
    );
    expect(dedent(markerRegion(workflow))).toBe(dedent(markerRegion(guardScript)));
    expect(Buffer.byteLength(workflow)).toBeLessThan(16 * 1024);
  });

  it("starts the web app only after the file-database guard and db:provision", () => {
    expect(webScript.indexOf("qa-sim-guard.sh")).toBeLessThan(
      webScript.indexOf("pnpm install"),
    );
    expect(webScript.indexOf("pnpm db:provision")).toBeGreaterThan(
      webScript.lastIndexOf("qa-sim-guard.sh"),
    );
    expect(webScript.indexOf("pnpm db:provision")).toBeLessThan(
      webScript.indexOf("pnpm exec next build"),
    );
    expect(webScript.indexOf("pnpm exec next build")).toBeLessThan(
      webScript.indexOf("next start -p 3108"),
    );
    expect(webScript).toContain('!= "file:local.db"');
    expect(collectScript).toContain("MAESTRO_TESTS_DIR");
    expect(collectScript).toContain("qa-sim-artifacts");
    expect(runner).toContain("qa-sim-guard.sh");
    expect(runner).toContain("qa-sim-web.sh");
    expect(runner).toContain("qa-sim-collect.sh");
  });
});

describe("qa-sim database guard", () => {
  it("accepts a file: URL and rejects Turso or any other URL without printing values", () => {
    const ok = runGuard({ DATABASE_URL: "file:local.db" });
    expect(ok.status).toBe(0);

    const absolute = runGuard({ DATABASE_URL: "file:/tmp/qa-sim.db" });
    expect(absolute.status).toBe(0);

    const remote = runGuard({
      DATABASE_URL: "libsql://db.example/secret-token",
    });
    expect(remote.status).toBe(1);
    expect(`${remote.stdout}${remote.stderr}`).not.toContain("secret-token");
    expect(`${remote.stdout}${remote.stderr}`).not.toContain("libsql");
    expect(remote.stderr).toContain("DATABASE_URL must start with file:");

    const missing = runGuard();
    expect(missing.status).toBe(1);

    const turso = runGuard({
      DATABASE_URL: "file:local.db",
      TURSO_AUTH_TOKEN: "turso-secret-value",
      TURSO_DATABASE_URL: "",
    });
    expect(turso.status).toBe(1);
    expect(turso.stderr).toContain("TURSO_AUTH_TOKEN");
    expect(turso.stderr).toContain("TURSO_DATABASE_URL");
    expect(`${turso.stdout}${turso.stderr}`).not.toContain("turso-secret-value");
  });
});

describe("qa-sim commit pin", () => {
  it("keeps an empty SHA and rejects a value that is not a full SHA without echoing it", () => {
    const empty = spawnSync("bash", [pinScript], {
      cwd: tmpdir(),
      env: commandEnv(),
      encoding: "utf8",
    });
    expect(empty.status).toBe(0);
    expect(empty.stdout).toContain("Using the checked-out project.");

    const badValue = "not-a-commit-secret";
    const bad = spawnSync("bash", [pinScript, badValue], {
      cwd: tmpdir(),
      env: commandEnv(),
      encoding: "utf8",
    });
    expect(bad.status).toBe(1);
    expect(`${bad.stdout}${bad.stderr}`).not.toContain(badValue);
  });

  it("accepts the commit that is already checked out", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "qa-sim-pin-"));
    const env = commandEnv();
    const git = (args: string[]) => {
      const result = spawnSync("git", args, { cwd: dir, env, encoding: "utf8" });
      expect(result.status, result.stderr).toBe(0);
    };
    git(["init", "-b", "main"]);
    writeFileSync(path.join(dir, "note.txt"), "pin\n");
    git(["add", "note.txt"]);
    git(["commit", "-m", "pin"]);
    const sha = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: dir,
      env,
      encoding: "utf8",
    }).stdout.trim();
    expect(sha).toMatch(/^[0-9a-f]{40}$/);

    const pinned = spawnSync("bash", [pinScript, sha], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    expect(pinned.status, pinned.stderr).toBe(0);
    expect(pinned.stdout).toContain(sha);

    const other = "0123456789abcdef0123456789abcdef01234567";
    const mismatch = spawnSync("bash", [pinScript, other], {
      cwd: dir,
      env,
      encoding: "utf8",
    });
    expect(mismatch.status).toBe(1);
    expect(mismatch.stderr).toContain("Dispatch the workflow on the candidate ref.");
    const after = spawnSync("git", ["rev-parse", "HEAD"], {
      cwd: dir,
      env,
      encoding: "utf8",
    }).stdout.trim();
    expect(after).toBe(sha);
    const script = readFileSync(pinScript, "utf8");
    expect(script).not.toContain("git fetch");
    expect(script).not.toContain("git checkout");
  });
});
