import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it } from "vitest";
import {
  DEFAULT_PUZZLE_CSV,
  LOCAL_DB_PATH,
  parseHomeworkArgs,
} from "./import-homework.mjs";

/** jsdom's URL is not a Node URL, so `fileURLToPath` rejects it. */
function pathFromMeta(relative: string) {
  return decodeURIComponent(new URL(relative, import.meta.url).pathname);
}

const scriptPath = pathFromMeta("./import-homework.mjs");
const repoCsv = resolve(pathFromMeta("../../../data/chess-school-puzzles.csv.gz"));

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempDir(prefix: string) {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function runImport(args: string[], cwd: string) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolveRun, reject) => {
      const child = spawn(process.execPath, [scriptPath, ...args], {
        cwd,
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk: string) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk: string) => {
        stderr += chunk;
      });
      child.on("error", reject);
      child.on("close", (code) => {
        resolveRun({ code, stdout, stderr });
      });
    },
  );
}

describe("import-homework local.db path", () => {
  it("resolves local.db from the script file, not the cwd", () => {
    const previous = process.cwd();
    const dir = tempDir("hw-db-path-");
    try {
      process.chdir(dir);
      expect(LOCAL_DB_PATH).toBe(resolve(pathFromMeta(".."), "local.db"));
      expect(LOCAL_DB_PATH).not.toBe(resolve(dir, "local.db"));
    } finally {
      process.chdir(previous);
    }
  });
});

describe("import-homework CSV path", () => {
  it("resolves the repo .csv.gz from different cwds", () => {
    const previous = process.cwd();
    const dirA = tempDir("hw-cwd-a-");
    const dirB = tempDir("hw-cwd-b-");
    try {
      process.chdir(dirA);
      const fromA = parseHomeworkArgs(["node", "import-homework.mjs"]);
      process.chdir(dirB);
      const fromB = parseHomeworkArgs(["node", "import-homework.mjs"]);
      expect(fromA).toEqual({ ok: true, mode: "import", input: repoCsv });
      expect(fromB).toEqual({ ok: true, mode: "import", input: repoCsv });
      expect(DEFAULT_PUZZLE_CSV).toBe(repoCsv);
      expect(existsSync(repoCsv)).toBe(true);
      expect(fromA.input).not.toBe(resolve(dirA, "data/chess-school-puzzles.csv.gz"));
      expect(fromB.input).not.toBe(resolve(dirB, "data/chess-school-puzzles.csv.gz"));
    } finally {
      process.chdir(previous);
    }
  });

  it("resolves an explicit relative path from the given cwd", () => {
    const dir = tempDir("hw-rel-");
    const plan = parseHomeworkArgs(["node", "import-homework.mjs", "puzzles.csv.gz"], {
      cwd: dir,
      exists: (path) => path === join(dir, "puzzles.csv.gz"),
    });
    expect(plan).toEqual({
      ok: true,
      mode: "import",
      input: join(dir, "puzzles.csv.gz"),
    });
  });

  it("errors when the default CSV is missing and does not select samples", () => {
    const plan = parseHomeworkArgs(["node", "import-homework.mjs"], {
      cwd: "/tmp",
      exists: () => false,
    });
    expect(plan.ok).toBe(false);
    if (plan.ok) return;
    expect(plan.exitCode).toBe(1);
    expect(plan.message).toMatch(
      /Puzzle CSV not found: .*chess-school-puzzles\.csv\.gz/,
    );
    expect(plan.message).toMatch(/does not fall back to sample puzzles/);
    expect(plan.message).not.toMatch(/deriving homework/i);
  });

  it("keeps sample homework behind --samples", () => {
    const plan = parseHomeworkArgs(["node", "import-homework.mjs", "--samples"], {
      exists: () => false,
    });
    expect(plan).toEqual({ ok: true, mode: "samples" });
    const rejected = parseHomeworkArgs(
      ["node", "import-homework.mjs", "--samples", "puzzles.csv"],
      { exists: () => false },
    );
    expect(rejected.ok).toBe(false);
    if (!rejected.ok) expect(rejected.message).toMatch(/does not take a puzzle file/);
  });
});

describe("import-homework CLI", () => {
  it("reads the repo .csv.gz when started from other directories", async () => {
    expect(existsSync(LOCAL_DB_PATH)).toBe(false);
    const dirs = ["hw-cli-a-", "hw-cli-b-"].map((prefix) => tempDir(prefix));
    const runs = await Promise.all(dirs.map((dir) => runImport([], dir)));
    const paths = runs.map((run, index) => {
      expect(run.code).toBe(1);
      expect(run.stdout).toContain(`Reading ${repoCsv} … homework pool`);
      expect(run.stdout).toContain("Scanned");
      expect(run.stdout).not.toMatch(/deriving homework/i);
      expect(run.stdout).not.toMatch(/Using --samples/);
      expect(run.stdout).not.toMatch(/Seeded \d+ homework/);
      expect(run.stderr).toMatch(/local\.db not found/);
      expect(run.stderr).toContain(LOCAL_DB_PATH);
      expect(run.stderr).not.toContain(dirs[index]);
      return run.stdout.match(/Reading (.+) … homework pool/)?.[1];
    });
    expect(paths).toEqual([repoCsv, repoCsv]);
  });

  it("exits with an error when the CSV path is missing", async () => {
    const dir = tempDir("hw-missing-");
    const missing = join(dir, "missing.csv.gz");
    const run = await runImport([missing], dir);
    expect(run.code).toBe(1);
    expect(run.stderr).toMatch(/Puzzle CSV not found/);
    expect(run.stderr).toMatch(/does not fall back to sample puzzles/);
    expect(run.stdout).not.toMatch(/Scanned/);
    expect(run.stdout).not.toMatch(/Seeded/);
    expect(run.stdout).not.toMatch(/Using --samples/);
  });

  it("builds homework from the seeded curriculum when --samples is set", async () => {
    const dir = tempDir("hw-samples-");
    const db = new Database(join(dir, "local.db"));
    db.exec("CREATE TABLE lessons (tag TEXT, steps TEXT)");
    const steps = JSON.stringify(
      Array.from({ length: 4 }, (_, index) => ({
        id: `s${index}`,
        kind: "move",
        fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
        solution: ["e1:e2"],
      })),
    );
    db.prepare("INSERT INTO lessons (tag, steps) VALUES (?, ?)").run("tactics", steps);
    db.close();

    const run = await runImport(["--samples"], dir);
    expect(run.code).toBe(0);
    expect(run.stdout).toMatch(/Using --samples/);
    expect(run.stdout).toMatch(/Seeded \d+ homework lessons/);
    expect(run.stdout).not.toMatch(/Reading .+homework pool/);

    const check = new Database(join(dir, "local.db"), { readonly: true });
    const count = check.prepare("SELECT COUNT(*) AS c FROM homework_lessons").get() as {
      c: number;
    };
    const ids = check.prepare("SELECT id FROM homework_lessons ORDER BY id").all() as {
      id: string;
    }[];
    check.close();
    expect(count.c).toBeGreaterThan(0);
    expect(ids.every((row) => row.id.startsWith("hw-"))).toBe(true);
  });
});
