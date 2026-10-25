import { createReadStream, existsSync, readFileSync } from "node:fs";
import { mkdtempSync, rmSync } from "node:fs";
import { createInterface } from "node:readline";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client, type Row } from "@libsql/client";
import { describe, expect, it, beforeAll, afterEach } from "vitest";

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
const SEED_PATH = () => join(webRoot(), "db/seed.sql");

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

async function stepsFromSeed(lessonId: string): Promise<string> {
  const needle = `VALUES ('${lessonId}',`;
  const rl = createInterface({
    input: createReadStream(SEED_PATH()),
    crlfDelay: Infinity,
  });
  for await (const line of rl) {
    if (!line.includes(needle)) continue;
    rl.close();
    const start = line.indexOf("VALUES (");
    const vals = parseValueList(line.slice(start + "VALUES (".length));
    const steps = vals[9];
    if (!steps?.startsWith("[")) throw new Error(`steps missing for ${lessonId}`);
    return steps;
  }
  throw new Error(`seed.sql has no ${lessonId}`);
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

async function openDb(): Promise<{ client: Client; cleanup: () => Promise<void> }> {
  const dir = mkdtempSync(join(tmpdir(), "starter-rename-"));
  const path = join(dir, "test.db");
  const client = createClient({ url: `file:${path}` });
  await client.executeMultiple(SCHEMA);
  return {
    client,
    cleanup: async () => {
      client.close();
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

  beforeAll(async () => {
    script = readFileSync(SQL_PATH(), "utf8");
    updates = parseUpdates(script);
    seeded = {
      "pre-game-goal": await stepsFromSeed("pre-game-goal"),
      "pre-notation-practice": await stepsFromSeed("pre-notation-practice"),
    };
  });

  afterEach(async () => {
    while (cleanups.length) await cleanups.pop()?.();
  });

  it("matches staging seed.sql and the f7a74c2 coach sentences exactly", () => {
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
    const commit = script.search(/^\s*COMMIT;/m);
    expect(begin).toBeGreaterThanOrEqual(0);
    expect(begin).toBeLessThan(select);
    expect(select).toBeLessThan(update);
    expect(update).toBeLessThan(commit);

    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    expect(byId["pre-game-goal"]!.prev).toBe(seeded["pre-game-goal"]);
    expect(byId["pre-notation-practice"]!.prev).toBe(seeded["pre-notation-practice"]);
    expect(byId["pre-game-goal"]!.next).toBe(
      seeded["pre-game-goal"]!.replace(GOAL_OLD_COACH, GOAL_NEW_COACH),
    );
    expect(byId["pre-notation-practice"]!.next).toBe(
      seeded["pre-notation-practice"]!.replace(FINISH_OLD_COACH, FINISH_NEW_COACH),
    );
    expect(coachWith(byId["pre-game-goal"]!.prev, "Pre-School")).toBe(GOAL_OLD_COACH);
    expect(coachWith(byId["pre-game-goal"]!.next, "Starter")).toBe(GOAL_NEW_COACH);
    expect(coachWith(byId["pre-notation-practice"]!.prev, "Pre-School")).toBe(
      FINISH_OLD_COACH,
    );
    expect(coachWith(byId["pre-notation-practice"]!.next, "Starter")).toBe(
      FINISH_NEW_COACH,
    );
    for (const row of updates) {
      const oldJson = JSON.parse(row.prev) as unknown[];
      const newJson = JSON.parse(row.next) as unknown[];
      expect(newJson).toHaveLength(oldJson.length);
    }
  });

  it("records that the stage display name is not a database row", () => {
    const school = readFileSync(join(webRoot(), "content/data/school.mjs"), "utf8");
    expect(school).toMatch(/id:\s*"preschool"[\s\S]*?name:\s*"Pre-School"/);
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
    expect(pkg.scripts["db:fresh"]).not.toContain("oneoff");
    expect(pkg.scripts["db:fresh"]).not.toContain("starter-rename");
    expect(existsSync(join(webRoot(), "db/migrations"))).toBe(false);
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

  it("is a no-op when the stored text differs from the old exact value", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    await seed(
      db.client,
      `${byId["pre-game-goal"]!.prev} `,
      byId["pre-notation-practice"]!.prev.replace("Pre-School", "Preschool"),
    );
    const before = await snapshot(db.client);
    await applyScript(db.client);
    expect(await snapshot(db.client)).toEqual(before);
  });

  it("updates only the row whose steps still match exactly", async () => {
    const db = await openDb();
    cleanups.push(db.cleanup);
    const byId = Object.fromEntries(updates.map((row) => [row.id, row]));
    const other = "not the old json";
    await seed(db.client, byId["pre-game-goal"]!.prev, other);
    await applyScript(db.client);
    expect(await stepsOf(db.client, "pre-game-goal")).toBe(byId["pre-game-goal"]!.next);
    expect(await stepsOf(db.client, "pre-notation-practice")).toBe(other);
    expect(await stepsOf(db.client, "decoy-same-steps")).toBe(
      byId["pre-game-goal"]!.prev,
    );
    const homework = await db.client.execute(
      "SELECT steps FROM homework_lessons WHERE id = 'hw-1'",
    );
    expect(homework.rows[0]?.steps).toBe(byId["pre-game-goal"]!.prev);
    const user = await db.client.execute("SELECT name FROM users WHERE id = 'user-1'");
    expect(user.rows[0]?.name).toBe("Pre-School");
  });
});
