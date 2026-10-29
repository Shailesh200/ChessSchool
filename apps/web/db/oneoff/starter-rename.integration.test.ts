import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client, type Row } from "@libsql/client";
import { describe, expect, it, beforeAll, afterEach } from "vitest";
import { readSeedSql } from "../seed-file.mjs";

const SOURCE_SHA = "f7a74c2";
const FULL_SHA = "f7a74c2f50038b7044c45a977d8e0b9ffe3f56e5";

const GOAL_OLD_COACH =
  "The goal of chess is to checkmate your opponent's king. You can also win if they resign (give up) when the position is hopeless. In Pre-School we learn the rules \u2014 real timed games come later in Play mode!";
const GOAL_NEW_COACH =
  "The goal of chess is to checkmate your opponent's king. You can also win if they resign (give up) when the position is hopeless. In the Starter stage we learn the rules \u2014 real timed games come later in Play mode!";
const FINISH_OLD_COACH =
  "You now know the board, the pieces, and how to read moves like d6, e4, Nf3, and Qd5. Pre-School complete \u2014 head to Elementary when you are ready, or replay any lesson for practice!";
const FINISH_NEW_COACH =
  "You now know the board, the pieces, and how to read moves like d6, e4, Nf3, and Qd5. Starter complete \u2014 head to Elementary when you are ready, or replay any lesson for practice!";

const TARGETS = ["pre-game-goal", "pre-notation-practice"] as const;

function webRoot(): string {
  return process.cwd();
}

const SQL_PATH = () => join(webRoot(), "db/oneoff/2026-10-starter-rename.sql");

type Update = { id: string; next: string; prev: string };
type Snap = Record<string, Record<string, string | number | null>[]>;

function parseSqlStringAt(sql: string, start: number): { value: string; end: number } {
  if (sql[start] !== "'") throw new Error("expected SQL string");
  let i = start + 1;
  let value = "";
  while (i < sql.length) {
    if (sql[i] === "'") {
      if (sql[i + 1] === "'") {
        value += "'";
        i += 2;
        continue;
      }
      return { value, end: i + 1 };
    }
    value += sql[i];
    i += 1;
  }
  throw new Error("unterminated SQL string");
}

function parseUpdates(sql: string): Update[] {
  const updates: Update[] = [];
  const marker = "UPDATE lessons SET steps = ";
  let from = 0;
  while (from < sql.length) {
    const at = sql.indexOf(marker, from);
    if (at < 0) break;
    const set = parseSqlStringAt(sql, at + marker.length);
    const idMarker = "WHERE id = '";
    const idAt = sql.indexOf(idMarker, set.end);
    if (idAt < 0) throw new Error("missing lesson id");
    const idEnd = sql.indexOf("'", idAt + idMarker.length);
    const id = sql.slice(idAt + idMarker.length, idEnd);
    const andMarker = "AND steps = ";
    const andAt = sql.indexOf(andMarker, idEnd);
    if (andAt < 0) throw new Error("missing steps predicate");
    const prev = parseSqlStringAt(sql, andAt + andMarker.length);
    updates.push({ id, next: set.value, prev: prev.value });
    from = prev.end;
  }
  return updates;
}

function parseValueList(input: string): string[] {
  const vals: string[] = [];
  let i = 0;
  while (i < input.length && vals.length < 11) {
    while (i < input.length && " \n\t".includes(input[i]!)) i += 1;
    if (input[i] === "'") {
      const parsed = parseSqlStringAt(input, i);
      vals.push(parsed.value);
      i = parsed.end;
    } else if (input.startsWith("NULL", i)) {
      vals.push("");
      i += 4;
    } else {
      const rest = input.slice(i);
      const cut = rest.search(/[,)]/);
      if (cut < 0) break;
      vals.push(rest.slice(0, cut).trim());
      i += cut;
    }
    while (i < input.length && " \n\t".includes(input[i]!)) i += 1;
    if (input[i] === ",") {
      i += 1;
      continue;
    }
    break;
  }
  return vals;
}

function stepsFromSeed(sql: string, lessonId: string): string {
  const needle = `VALUES ('${lessonId}',`;
  const idx = sql.indexOf(needle);
  if (idx < 0) throw new Error(`committed seed has no ${lessonId}`);
  const lineStart = sql.lastIndexOf("\n", idx) + 1;
  const lineEnd = sql.indexOf("\n", idx);
  const line = sql.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
  const start = line.indexOf("VALUES (");
  const vals = parseValueList(line.slice(start + "VALUES (".length));
  const steps = vals[9];
  if (!steps?.startsWith("[")) throw new Error(`steps missing for ${lessonId}`);
  return steps;
}

function coachWith(steps: string, needle: string): string {
  const parsed = JSON.parse(steps) as { coach?: string }[];
  const coach = parsed.find((step) => step.coach?.includes(needle))?.coach;
  if (!coach) throw new Error(`coach containing ${needle} not found`);
  return coach;
}

function stripCommentsAndStrings(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    if (sql.startsWith("--", i)) {
      const nl = sql.indexOf("\n", i);
      i = nl < 0 ? sql.length : nl + 1;
      continue;
    }
    if (sql[i] === "'") {
      i += 1;
      while (i < sql.length) {
        if (sql[i] === "'" && sql[i + 1] === "'") {
          i += 2;
          continue;
        }
        if (sql[i] === "'") {
          i += 1;
          break;
        }
        i += 1;
      }
      continue;
    }
    out += sql[i];
    i += 1;
  }
  return out;
}

const SCHEMA = `
CREATE TABLE semesters (
  id text PRIMARY KEY NOT NULL,
  title text NOT NULL,
  blurb text NOT NULL,
  color text NOT NULL,
  stage text NOT NULL,
  sort_order integer NOT NULL
);
CREATE TABLE classes (
  id text PRIMARY KEY NOT NULL,
  semester_id text NOT NULL,
  title text NOT NULL,
  emoji text NOT NULL,
  blurb text NOT NULL,
  difficulty integer NOT NULL,
  exam_id text,
  sort_order integer NOT NULL
);
CREATE TABLE lessons (
  id text PRIMARY KEY NOT NULL,
  class_id text NOT NULL,
  title text NOT NULL,
  subtitle text NOT NULL,
  emoji text NOT NULL,
  tag text NOT NULL,
  xp integer NOT NULL,
  is_exam integer NOT NULL,
  prerequisites text NOT NULL,
  steps text NOT NULL,
  sort_order integer NOT NULL
);
CREATE TABLE homework_lessons (
  id text PRIMARY KEY NOT NULL,
  type text NOT NULL,
  title text NOT NULL,
  steps text NOT NULL
);
CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL,
  name text NOT NULL
);
`;

function plain(row: Row, columns: string[]): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {};
  for (const column of columns) {
    const value = row[column];
    if (typeof value === "bigint") out[column] = Number(value);
    else if (value === null || typeof value === "string" || typeof value === "number") {
      out[column] = value;
    } else out[column] = value === undefined ? null : String(value);
  }
  return out;
}

async function snapshot(client: Client): Promise<Snap> {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
  );
  const snap: Snap = {};
  for (const tableRow of tables.rows) {
    const name = String(tableRow.name);
    const rows = await client.execute(
      `SELECT rowid AS _rowid, * FROM "${name}" ORDER BY rowid`,
    );
    snap[name] = rows.rows.map((row) => plain(row, rows.columns));
  }
  return snap;
}

/** `db:fresh` plus every `pnpm` script that command calls. */
function freshScriptChain(scripts: Record<string, string>): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const visit = (name: string) => {
    if (seen.has(name)) return;
    const command = scripts[name];
    if (command === undefined) throw new Error(`package.json has no script ${name}`);
    seen.add(name);
    order.push(name);
    for (const match of command.matchAll(/\bpnpm\s+(?:run\s+)?([A-Za-z0-9:_-]+)/g)) {
      const next = match[1];
      if (next !== undefined && next in scripts) visit(next);
    }
  };
  visit("db:fresh");
  return order;
}

/** Local files a package script starts. `drizzle-kit` reads drizzle.config.ts. */
function filesRunBy(command: string): string[] {
  const files: string[] = [];
  for (const match of command.matchAll(/\bnode\s+(\S+)/g)) {
    const path = match[1];
    if (path !== undefined) files.push(path);
  }
  if (/\bdrizzle-kit\b/.test(command)) files.push("drizzle.config.ts");
  return files;
}

function maskSteps(snap: Snap): Snap {
  return {
    ...snap,
    lessons: (snap.lessons ?? []).map((row) =>
      TARGETS.includes(row.id as (typeof TARGETS)[number])
        ? { ...row, steps: "<masked>" }
        : row,
    ),
  };
}

async function openDb(): Promise<{
  client: Client;
  path: string;
  close: () => void;
  cleanup: () => Promise<void>;
}> {
  const dir = mkdtempSync(join(tmpdir(), "starter-rename-"));
  const path = join(dir, "test.db");
  const client = createClient({ url: `file:${path}` });
  await client.executeMultiple(SCHEMA);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    client.close();
  };
  return {
    client,
    path,
    close,
    cleanup: async () => {
      close();
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

async function seed(
  client: Client,
  goalSteps: string,
  notationSteps: string,
): Promise<void> {
  await client.batch(
    [
      {
        sql: "INSERT INTO semesters (id, title, blurb, color, stage, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        args: ["sem-preschool", "Chess Basics", "Board", "#e879a5", "preschool", 0],
      },
      {
        sql: "INSERT INTO semesters (id, title, blurb, color, stage, sort_order) VALUES (?, ?, ?, ?, ?, ?)",
        args: ["sem-foundations", "Foundations", "Pieces", "#5b5bd6", "elementary", 1],
      },
      {
        sql: `INSERT INTO classes
              (id, semester_id, title, emoji, blurb, difficulty, exam_id, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          "class-pre-game",
          "sem-preschool",
          "Playing a Game",
          "🎮",
          "",
          1,
          null,
          12,
        ],
      },
      {
        sql: "INSERT INTO users (id, email, name) VALUES (?, ?, ?)",
        args: ["user-1", "student@example.com", "Pre-School"],
      },
      {
        sql: "INSERT INTO homework_lessons (id, type, title, steps) VALUES (?, ?, ?, ?)",
        args: ["hw-1", "practice", "Warmup", goalSteps],
      },
      ...[
        ["pre-game-goal", "class-pre-game", "Goal of the Game", goalSteps, 0],
        [
          "pre-notation-practice",
          "class-pre-language",
          "Play the Move",
          notationSteps,
          9,
        ],
        [
          "pre-game-clocks",
          "class-pre-game",
          "Chess Clocks",
          '[{"id":"x","coach":"Clocks later."}]',
          1,
        ],
        ["decoy-same-steps", "class-pre-game", "Pre-School", goalSteps, 2],
      ].map(([id, classId, title, steps, sortOrder]) => ({
        sql: `INSERT INTO lessons
              (id, class_id, title, subtitle, emoji, tag, xp, is_exam, prerequisites, steps, sort_order)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
          id,
          classId,
          title,
          "",
          "🎯",
          "preschool",
          10,
          0,
          "[]",
          steps,
          sortOrder,
        ],
      })),
    ],
    "write",
  );
}

async function applyScript(client: Client): Promise<void> {
  await client.executeMultiple(readFileSync(SQL_PATH(), "utf8"));
}

async function committedSnapshot(path: string): Promise<Snap> {
  const reader = createClient({ url: `file:${path}` });
  try {
    return await snapshot(reader);
  } finally {
    reader.close();
  }
}

/** Guard failure stops the batch before COMMIT. Closing rolls the transaction back. */
async function expectGuardAbort(
  db: { client: Client; path: string; close: () => void },
  before: Snap,
): Promise<void> {
  await expect(applyScript(db.client)).rejects.toThrow(/CHECK constraint failed/);
  db.close();
  expect(await committedSnapshot(db.path)).toEqual(before);
}

async function stepsOf(client: Client, id: string): Promise<string> {
  const row = await client.execute({
    sql: "SELECT steps FROM lessons WHERE id = ?",
    args: [id],
  });
  return String(row.rows[0]?.steps);
}

describe("starter rename fallback sql", () => {
  let script = "";
  let updates: Update[] = [];
  let seeded: Record<string, string> = {};
  const cleanups: Array<() => Promise<void>> = [];

  beforeAll(() => {
    script = readFileSync(SQL_PATH(), "utf8");
    updates = parseUpdates(script);
    const seedSql = readSeedSql();
    seeded = {
      "pre-game-goal": stepsFromSeed(seedSql, "pre-game-goal"),
      "pre-notation-practice": stepsFromSeed(seedSql, "pre-notation-practice"),
    };
  });

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()?.();
  });

  it("matches the committed seed snapshot and the f7a74c2 coach sentences exactly", () => {
    expect(script).toContain(SOURCE_SHA);
    expect(script).toContain(FULL_SHA);
    expect(updates.map((row) => row.id)).toEqual([...TARGETS]);
    expect(stripCommentsAndStrings(script)).not.toMatch(/\bLIKE\b/i);
    expect(script.split("\n").filter((line) => line.trim() === "BEGIN;")).toHaveLength(
      1,
    );
    expect(script.split("\n").filter((line) => line.trim() === "COMMIT;")).toHaveLength(
      1,
    );

    const begin = script.search(/^\s*BEGIN;/m);
    const select = script.search(/^\s*SELECT\b/m);
    const update = script.search(/^\s*UPDATE\b/m);
    const guard = script.search(
      /^CREATE TEMP TABLE _starter_guard \(n INTEGER CHECK \(n = 2\)\);/m,
    );
    const drop = script.search(/^DROP TABLE _starter_guard;/m);
    const commit = script.search(/^\s*COMMIT;/m);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(begin).toBeLessThan(select);
    expect(select).toBeLessThan(update);
    expect(update).toBeLessThan(guard);
    expect(guard).toBeLessThan(drop);
    expect(drop).toBeLessThan(commit);
    expect(script).toContain(".bail on");
    expect(script).toContain("read-only SELECT");

    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    expect(seeded["pre-game-goal"]).toBe(byId["pre-game-goal"]!.next);
    expect(seeded["pre-notation-practice"]).toBe(byId["pre-notation-practice"]!.next);
    expect(byId["pre-game-goal"]!.next).toBe(
      byId["pre-game-goal"]!.prev.replace(GOAL_OLD_COACH, GOAL_NEW_COACH),
    );
    expect(byId["pre-notation-practice"]!.next).toBe(
      byId["pre-notation-practice"]!.prev.replace(FINISH_OLD_COACH, FINISH_NEW_COACH),
    );
    expect(coachWith(byId["pre-game-goal"]!.prev, "Pre-School")).toBe(GOAL_OLD_COACH);
    expect(coachWith(byId["pre-game-goal"]!.next, "Starter")).toBe(GOAL_NEW_COACH);
    expect(coachWith(byId["pre-notation-practice"]!.prev, "Pre-School")).toBe(
      FINISH_OLD_COACH,
    );
    expect(coachWith(byId["pre-notation-practice"]!.next, "Starter")).toBe(
      FINISH_NEW_COACH,
    );
    const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
    expect(script).toContain(
      `(id = 'pre-game-goal' AND steps = ${quote(byId["pre-game-goal"]!.next)})`,
    );
    expect(script).toContain(
      `(id = 'pre-notation-practice' AND steps = ${quote(byId["pre-notation-practice"]!.next)})`,
    );
    for (const row of updates) {
      const oldJson = JSON.parse(row.prev) as unknown[];
      const newJson = JSON.parse(row.next) as unknown[];
      expect(newJson).toHaveLength(oldJson.length);
    }
  });

  it("records that the stage display name is not a database row", () => {
    const school = readFileSync(join(webRoot(), "content/data/school.mjs"), "utf8");
    expect(school).toMatch(/id:\s*"preschool"[\s\S]*?name:\s*"Starter"/);
    const schema = readFileSync(join(webRoot(), "db/schema.ts"), "utf8");
    expect(schema).not.toContain('sqliteTable("stages"');
    expect(script).toContain("stage-name source: apps/web/content/data/school.mjs:5");
    expect(script).toContain("stage-name id: preschool");
    expect(script).toContain("stage-name property: name");
    expect(script).toContain("stage-name table: none");
    expect(script).toContain("stage-name column: none");
    expect(script).toContain("stage-name old: Pre-School");
    expect(script).toContain("stage-name new: Starter");
    expect(script).not.toMatch(/\bUPDATE\s+semesters\b/i);
    expect(script).not.toMatch(/\bUPDATE\s+stages\b/i);

    const pkg = JSON.parse(readFileSync(join(webRoot(), "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const chain = freshScriptChain(pkg.scripts);
    expect(chain).toEqual(
      expect.arrayContaining([
        "db:fresh",
        "db:reset",
        "db:push",
        "db:seed",
        "db:seed-homework",
      ]),
    );
    for (const name of chain) {
      const command = pkg.scripts[name]!;
      expect(command).not.toContain("oneoff");
      for (const rel of filesRunBy(command)) {
        const text = readFileSync(join(webRoot(), rel), "utf8");
        expect(text).not.toContain("db/oneoff/");
      }
    }
    expect(
      execSync("git ls-files apps/web/db/seed.sql", { encoding: "utf8" }).trim(),
    ).toBe("");
  });

  it("rewrites the two old rows, leaves every other cell, and is idempotent", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    await seed(
      db.client,
      byId["pre-game-goal"]!.prev,
      byId["pre-notation-practice"]!.prev,
    );
    const before = await snapshot(db.client);
    await applyScript(db.client);
    const after = await snapshot(db.client);

    expect(await stepsOf(db.client, "pre-game-goal")).toBe(byId["pre-game-goal"]!.next);
    expect(await stepsOf(db.client, "pre-notation-practice")).toBe(
      byId["pre-notation-practice"]!.next,
    );
    expect(maskSteps(after)).toEqual(maskSteps(before));

    const semester = await db.client.execute(
      "SELECT title, stage FROM semesters WHERE id = 'sem-preschool'",
    );
    expect(semester.rows[0]?.title).toBe("Chess Basics");
    expect(semester.rows[0]?.stage).toBe("preschool");
    const foundations = await db.client.execute(
      "SELECT title FROM semesters WHERE id = 'sem-foundations'",
    );
    expect(foundations.rows[0]?.title).toBe("Foundations");

    await applyScript(db.client);
    expect(await snapshot(db.client)).toEqual(after);
  });

  it("is a no-op when the text was already replaced", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    await seed(
      db.client,
      byId["pre-game-goal"]!.next,
      byId["pre-notation-practice"]!.next,
    );
    const before = await snapshot(db.client);
    await applyScript(db.client);
    expect(await snapshot(db.client)).toEqual(before);
  });

  it("aborts and leaves both cells unchanged when the stored text differs", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    await seed(
      db.client,
      `${byId["pre-game-goal"]!.prev} `,
      byId["pre-notation-practice"]!.prev.replace("Pre-School", "Preschool"),
    );
    const before = await snapshot(db.client);
    await expectGuardAbort(db, before);
  });

  it("rolls back both cells when one stored value differs by one byte", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    const goal = byId["pre-game-goal"]!.prev;
    const flipped = `${goal.slice(0, -1)}${goal.endsWith("]") ? "}" : "]"}`;
    expect(flipped).not.toBe(goal);
    expect(Buffer.byteLength(flipped)).toBe(Buffer.byteLength(goal));
    await seed(db.client, flipped, byId["pre-notation-practice"]!.prev);
    const before = await snapshot(db.client);
    await expectGuardAbort(db, before);
    const committed = await committedSnapshot(db.path);
    const lessons = committed.lessons ?? [];
    expect(lessons.find((row) => row.id === "pre-game-goal")?.steps).toBe(flipped);
    expect(lessons.find((row) => row.id === "pre-notation-practice")?.steps).toBe(
      byId["pre-notation-practice"]!.prev,
    );
    expect(lessons.find((row) => row.id === "decoy-same-steps")?.steps).toBe(flipped);
    expect(committed.homework_lessons?.[0]?.steps).toBe(flipped);
    expect(committed.users?.[0]?.name).toBe("Pre-School");
  });
});
