import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import Database from "better-sqlite3";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCTION_DB_HOSTS } from "../db/production-db-hosts.mjs";
import { loadContentSeed, upsertStatement } from "./seed-content.mjs";
import { contentShrinks, dumpLocalSeed } from "./dump.mjs";
import { runRemoteClean } from "./clean-seed-remote.mjs";
import { runWipeUsers } from "./wipe-user-data.mjs";

const PROD = PRODUCTION_DB_HOSTS[0];
const TOKEN = "super-secret-token";
const OTHER = "wipe-test.example";
const dirs: string[] = [];

afterEach(() => {
  vi.restoreAllMocks();
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function capture() {
  const lines: string[] = [];
  const push = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  vi.spyOn(console, "log").mockImplementation(push);
  vi.spyOn(console, "error").mockImplementation(push);
  return lines;
}

function assertNoSecrets(lines: string[], url: string) {
  const text = lines.join("\n");
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain(url);
  expect(text).not.toContain("libsql://");
  expect(text).not.toContain("authToken");
}

function hostedUrl(host: string) {
  return `libsql://${host}/chess?authToken=${TOKEN}`;
}

function fileClient(setup: (db: Database.Database) => void) {
  const dir = mkdtempSync(join(tmpdir(), "wipe-guard-"));
  dirs.push(dir);
  const dbPath = join(dir, "test.db");
  const sqlite = new Database(dbPath);
  setup(sqlite);
  sqlite.close();
  const client = createClient({ url: `file:${dbPath}` });
  const realClose = client.close.bind(client);
  client.close = () => {};
  return {
    client,
    async dispose() {
      realClose();
    },
  };
}

const CONTENT_DDL = `
CREATE TABLE semesters (
  id text PRIMARY KEY, title text NOT NULL, blurb text NOT NULL,
  color text NOT NULL, stage text NOT NULL, sort_order integer NOT NULL
);
CREATE TABLE classes (
  id text PRIMARY KEY, semester_id text NOT NULL, title text NOT NULL,
  emoji text NOT NULL, blurb text NOT NULL, difficulty integer NOT NULL,
  exam_id text, sort_order integer NOT NULL
);
CREATE TABLE lessons (
  id text PRIMARY KEY, class_id text NOT NULL, title text NOT NULL,
  subtitle text NOT NULL, emoji text NOT NULL, tag text NOT NULL,
  xp integer NOT NULL, is_exam integer NOT NULL, prerequisites text NOT NULL,
  steps text NOT NULL, sort_order integer NOT NULL
);
CREATE TABLE homework_lessons (
  id text PRIMARY KEY, type text NOT NULL, title text NOT NULL,
  subtitle text NOT NULL, emoji text NOT NULL, tag text NOT NULL,
  xp integer NOT NULL, steps text NOT NULL, sort_order integer NOT NULL
);
`;

function insertCurriculum(db: Database.Database, lessonIds: string[]) {
  db.prepare(
    "INSERT INTO semesters (id, title, blurb, color, stage, sort_order) VALUES ('sem-1','Sem','','#000','elementary',0)",
  ).run();
  db.prepare(
    "INSERT INTO classes (id, semester_id, title, emoji, blurb, difficulty, exam_id, sort_order) VALUES ('class-1','sem-1','Class','♟️','',1,NULL,0)",
  ).run();
  db.prepare(
    "INSERT INTO homework_lessons (id, type, title, subtitle, emoji, tag, xp, steps, sort_order) VALUES ('hw-1','warmup','Warmup','','♟️','drill',20,'[]',0)",
  ).run();
  const insert = db.prepare(
    "INSERT INTO lessons (id, class_id, title, subtitle, emoji, tag, xp, is_exam, prerequisites, steps, sort_order) VALUES (?, 'class-1', ?, '', '♟️', 'drill', 20, 0, '[]', '[]', 0)",
  );
  for (const id of lessonIds) insert.run(id, id);
}

function contentDb(lessonIds: string[]) {
  const dir = mkdtempSync(join(tmpdir(), "dump-shrink-"));
  dirs.push(dir);
  const dbPath = join(dir, "local.db");
  const seedPath = join(dir, "seed.sql");
  const db = new Database(dbPath);
  db.exec(CONTENT_DDL);
  insertCurriculum(db, lessonIds);
  db.close();
  return { dbPath, seedPath };
}

describe("wipe confirm", () => {
  const cases = [
    { name: "db:wipe-users", run: runWipeUsers },
    { name: "db:remote-clean", run: runRemoteClean },
  ] as const;

  for (const script of cases) {
    it(`${script.name} refuses the production host even with matching confirm`, async () => {
      for (const host of [PROD, PROD.toUpperCase()]) {
        const url = hostedUrl(host);
        const lines = capture();
        const openClient = vi.fn(() => {
          throw new Error(`opened ${url} ${TOKEN}`);
        });
        const code = await script.run({
          url,
          authToken: TOKEN,
          confirm: `WIPE:${host}`,
          openClient,
        });
        expect(code).toBe(1);
        expect(openClient).not.toHaveBeenCalled();
        const text = lines.join("\n");
        expect(text).toContain(`Refusing to wipe production host ${host}.`);
        expect(text).toContain("No rows were deleted.");
        assertNoSecrets(lines, url);
      }
    });

    it(`${script.name} refuses a missing or wrong confirm before connecting`, async () => {
      const url = hostedUrl(OTHER);
      for (const confirm of [undefined, "WIPE", `WIPE:other.example`]) {
        const lines = capture();
        const openClient = vi.fn(() => {
          throw new Error(`opened ${TOKEN}`);
        });
        const code = await script.run({
          url,
          authToken: TOKEN,
          confirm,
          openClient,
        });
        expect(code).toBe(1);
        expect(openClient).not.toHaveBeenCalled();
        expect(lines.join("\n")).toContain(`Set CONFIRM=WIPE:${OTHER}.`);
        assertNoSecrets(lines, url);
      }
    });
  }

  it("db:wipe-users deletes user rows on a non-prod host and keeps lessons", async () => {
    const url = hostedUrl(OTHER);
    const { client, dispose } = fileClient((db) => {
      db.exec(`
        CREATE TABLE users (id text PRIMARY KEY, email text);
        CREATE TABLE game_sessions (id text PRIMARY KEY, fen text);
        CREATE TABLE lessons (id text PRIMARY KEY, title text);
        CREATE TABLE homework_lessons (id text PRIMARY KEY);
        INSERT INTO users VALUES ('user-1', 'a@example.com');
        INSERT INTO game_sessions VALUES ('game-1', 'fen');
        INSERT INTO lessons VALUES ('lesson-keep', 'Kept');
        INSERT INTO homework_lessons VALUES ('hw-1');
      `);
    });
    const lines = capture();
    const code = await runWipeUsers({
      url,
      authToken: TOKEN,
      confirm: `WIPE:${OTHER}`,
      openClient: () => client,
    });
    expect(code).toBe(0);
    const users = await client.execute("SELECT COUNT(*) AS c FROM users");
    const games = await client.execute("SELECT COUNT(*) AS c FROM game_sessions");
    const lessons = await client.execute(
      "SELECT title FROM lessons WHERE id = 'lesson-keep'",
    );
    expect(Number(users.rows[0].c)).toBe(0);
    expect(Number(games.rows[0].c)).toBe(0);
    expect(lessons.rows[0].title).toBe("Kept");
    expect(lines.join("\n")).toContain(`Wiping user and analytics rows on ${OTHER}.`);
    assertNoSecrets(lines, url);
    await dispose();
  });

  it("db:remote-clean wipes users and upserts content on a non-prod host", async () => {
    const url = hostedUrl(OTHER);
    const { client, dispose } = fileClient((db) => {
      db.exec(`
        CREATE TABLE "__drizzle_migrations" (
          id integer PRIMARY KEY, hash text NOT NULL, created_at numeric
        );
        INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ('abc', 1);
        CREATE TABLE users (id text PRIMARY KEY, email text);
        CREATE TABLE game_sessions (id text PRIMARY KEY, fen text);
        INSERT INTO users VALUES ('user-1', 'a@example.com');
        INSERT INTO game_sessions VALUES ('game-1', 'fen');
        ${CONTENT_DDL}
      `);
      insertCurriculum(db, ["lesson-keep"]);
      db.prepare(
        "UPDATE lessons SET title = 'Old title' WHERE id = 'lesson-keep'",
      ).run();
    });
    const lesson = upsertStatement(
      "lessons",
      [
        "id",
        "class_id",
        "title",
        "subtitle",
        "emoji",
        "tag",
        "xp",
        "is_exam",
        "prerequisites",
        "steps",
        "sort_order",
      ],
      {
        id: "lesson-keep",
        class_id: "class-1",
        title: "New title",
        subtitle: "",
        emoji: "♟️",
        tag: "drill",
        xp: 20,
        is_exam: 0,
        prerequisites: "[]",
        steps: "[]",
        sort_order: 0,
      },
    );
    const semester = upsertStatement(
      "semesters",
      ["id", "title", "blurb", "color", "stage", "sort_order"],
      {
        id: "sem-1",
        title: "Sem",
        blurb: "",
        color: "#000",
        stage: "elementary",
        sort_order: 0,
      },
    );
    const schoolClass = upsertStatement(
      "classes",
      [
        "id",
        "semester_id",
        "title",
        "emoji",
        "blurb",
        "difficulty",
        "exam_id",
        "sort_order",
      ],
      {
        id: "class-1",
        semester_id: "sem-1",
        title: "Class",
        emoji: "♟️",
        blurb: "",
        difficulty: 1,
        exam_id: null,
        sort_order: 0,
      },
    );
    const homework = upsertStatement(
      "homework_lessons",
      ["id", "type", "title", "subtitle", "emoji", "tag", "xp", "steps", "sort_order"],
      {
        id: "hw-1",
        type: "warmup",
        title: "Warmup",
        subtitle: "",
        emoji: "♟️",
        tag: "drill",
        xp: 20,
        steps: "[]",
        sort_order: 0,
      },
    );
    const lines = capture();
    const code = await runRemoteClean({
      url,
      authToken: TOKEN,
      confirm: `WIPE:${OTHER}`,
      sql: [semester, schoolClass, lesson, homework].join("\n"),
      openClient: () => client,
    });
    expect(code).toBe(0);
    const users = await client.execute("SELECT COUNT(*) AS c FROM users");
    const games = await client.execute("SELECT COUNT(*) AS c FROM game_sessions");
    const title = await client.execute(
      "SELECT title FROM lessons WHERE id = 'lesson-keep'",
    );
    expect(Number(users.rows[0].c)).toBe(0);
    expect(Number(games.rows[0].c)).toBe(0);
    expect(title.rows[0].title).toBe("New title");
    expect(lines.join("\n")).toContain(`Wiping user rows on ${OTHER}.`);
    assertNoSecrets(lines, url);
    await dispose();
  });
});

describe("dump shrink guard", () => {
  it("names a shrink and allows equal or larger counts", () => {
    expect(
      contentShrinks({ lessons: 3, classes: 1 }, { lessons: 3, classes: 2 }),
    ).toEqual([]);
    expect(contentShrinks({ lessons: 3 }, { lessons: 2, classes: 9 })).toEqual([
      { table: "lessons", from: 3, to: 2 },
    ]);
  });

  it("refuses to write a smaller snapshot", () => {
    const { dbPath, seedPath } = contentDb(["lesson-a", "lesson-b"]);
    const lines = capture();
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(0);
    const original = readFileSync(seedPath, "utf8");
    const db = new Database(dbPath);
    db.prepare("DELETE FROM lessons WHERE id = 'lesson-b'").run();
    db.close();
    lines.length = 0;
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(1);
    expect(lines.join("\n")).toContain("lessons: 2 → 1");
    expect(lines.join("\n")).toContain("Pass --allow-shrink");
    expect(lines.join("\n")).toContain("No file was written.");
    expect(readFileSync(seedPath, "utf8")).toBe(original);
  });

  it("writes a smaller snapshot when --allow-shrink is set", () => {
    const { dbPath, seedPath } = contentDb(["lesson-a", "lesson-b"]);
    capture();
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(0);
    const db = new Database(dbPath);
    db.prepare("DELETE FROM lessons WHERE id = 'lesson-b'").run();
    db.close();
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath, allowShrink: true })).toBe(0);
    expect(loadContentSeed(readFileSync(seedPath, "utf8")).counts.lessons).toBe(1);
  });

  it("allows an equal snapshot and a larger one", () => {
    const { dbPath, seedPath } = contentDb(["lesson-a"]);
    capture();
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(0);
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(0);
    expect(loadContentSeed(readFileSync(seedPath, "utf8")).counts.lessons).toBe(1);
    const db = new Database(dbPath);
    db.prepare(
      "INSERT INTO lessons (id, class_id, title, subtitle, emoji, tag, xp, is_exam, prerequisites, steps, sort_order) VALUES ('lesson-b', 'class-1', 'B', '', '♟️', 'drill', 20, 0, '[]', '[]', 1)",
    ).run();
    db.close();
    expect(dumpLocalSeed({ localDbPath: dbPath, seedPath })).toBe(0);
    expect(loadContentSeed(readFileSync(seedPath, "utf8")).counts.lessons).toBe(2);
  });
});

describe("wipe CLI", () => {
  function cli(script: string, env: Record<string, string | undefined>) {
    const childEnv = { ...process.env };
    delete childEnv.DATABASE_URL;
    delete childEnv.DATABASE_AUTH_TOKEN;
    delete childEnv.CONFIRM;
    for (const [key, value] of Object.entries(env)) {
      if (value === undefined) delete childEnv[key];
      else childEnv[key] = value;
    }
    return spawnSync(process.execPath, [script], {
      cwd: process.cwd(),
      env: childEnv,
      encoding: "utf8",
      timeout: 5000,
    });
  }

  it("db:wipe-users exits when local confirm is missing", () => {
    const result = cli("scripts/wipe-user-data.mjs", {});
    expect(result.status).toBe(1);
    const text = `${result.stdout}${result.stderr}`;
    expect(text).toContain("CONFIRM=WIPE:local.db");
    expect(text).not.toContain(TOKEN);
  });

  it("db:remote-clean exits when confirm does not match the hostname", () => {
    const result = cli("scripts/clean-seed-remote.mjs", {
      DATABASE_URL: "libsql://127.0.0.1:9/chess",
      DATABASE_AUTH_TOKEN: TOKEN,
      CONFIRM: "WIPE",
    });
    expect(result.status).toBe(1);
    const text = `${result.stdout}${result.stderr}`;
    expect(text).toContain("CONFIRM=WIPE:127.0.0.1");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("libsql://");
  });
});
