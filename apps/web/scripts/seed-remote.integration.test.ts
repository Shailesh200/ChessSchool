import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { afterEach, describe, expect, it, vi } from "vitest";
import { renderContentSeed } from "./dump.mjs";
import {
  CONTENT_TABLES,
  databaseHostname,
  loadContentSeed,
  upsertStatement,
} from "./seed-content.mjs";
import { redactSecrets, runSeedRemote } from "./seed-remote.mjs";

const HOST = "seed-guard.test";
const TOKEN = "super-secret-token";
const REMOTE_URL = `libsql://${HOST}/chess?authToken=${TOKEN}`;
const SEMESTER_COLS = ["id", "title", "blurb", "color", "stage", "sort_order"];
const CLASS_COLS = [
  "id",
  "semester_id",
  "title",
  "emoji",
  "blurb",
  "difficulty",
  "exam_id",
  "sort_order",
];
const LESSON_COLS = [
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
];
const HOMEWORK_COLS = [
  "id",
  "type",
  "title",
  "subtitle",
  "emoji",
  "tag",
  "xp",
  "steps",
  "sort_order",
];

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

function contentSeed() {
  const semester = {
    id: "sem-1",
    title: "Sem",
    blurb: "",
    color: "#5b5bd6",
    stage: "elementary",
    sort_order: 0,
  };
  const schoolClass = {
    id: "class-1",
    semester_id: "sem-1",
    title: "Class",
    emoji: "♟️",
    blurb: "",
    difficulty: 1,
    exam_id: null,
    sort_order: 0,
  };
  const lesson = {
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
  };
  const homework = {
    id: "hw-1",
    type: "warmup",
    title: "Warmup",
    subtitle: "",
    emoji: "♟️",
    tag: "drill",
    xp: 20,
    steps: "[]",
    sort_order: 0,
  };
  return [
    upsertStatement("semesters", SEMESTER_COLS, semester),
    upsertStatement("classes", CLASS_COLS, schoolClass),
    upsertStatement("lessons", LESSON_COLS, lesson),
    upsertStatement("homework_lessons", HOMEWORK_COLS, homework),
  ]
    .map((sql) => `${sql};`)
    .join("\n");
}

function migratedFile() {
  const dir = mkdtempSync(join(tmpdir(), "seed-guard-"));
  dirs.push(dir);
  const dbPath = join(dir, "test.db");
  const sqlite = new Database(dbPath);
  migrate(drizzle(sqlite), {
    migrationsFolder: join(process.cwd(), "db/migrations"),
  });
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

async function seedFixtures(client: Client) {
  await client.execute("PRAGMA foreign_keys = ON");
  await client.execute({
    sql: `INSERT INTO users (id, email, password_hash, name, role, created_at)
          VALUES (?, ?, ?, ?, ?, ?)`,
    args: ["user-1", "a@example.com", "hash", "A", "student", 1],
  });
  await client.execute({
    sql: `INSERT INTO semesters (id, title, blurb, color, stage, sort_order)
          VALUES ('sem-1', 'Old sem', '', '#5b5bd6', 'elementary', 0)`,
  });
  await client.execute({
    sql: `INSERT INTO classes
            (id, semester_id, title, emoji, blurb, difficulty, exam_id, sort_order)
          VALUES ('class-1', 'sem-1', 'Old class', '♟️', '', 1, NULL, 0)`,
  });
  await client.execute({
    sql: `INSERT INTO lessons
            (id, class_id, title, subtitle, emoji, tag, xp, is_exam, prerequisites, steps, sort_order)
          VALUES ('lesson-keep', 'class-1', 'Old title', '', '♟️', 'drill', 20, 0, '[]', '[]', 0)`,
  });
  await client.execute({
    sql: `INSERT INTO lessons
            (id, class_id, title, subtitle, emoji, tag, xp, is_exam, prerequisites, steps, sort_order)
          VALUES ('lesson-stale', 'class-1', 'Stale', '', '♟️', 'drill', 20, 0, '[]', '[]', 1)`,
  });
  await client.execute({
    sql: `INSERT INTO progress
            (user_id, xp, streak, daily_goal_xp, graduated_classes, data, updated_at)
          VALUES ('user-1', 42, 3, 50, '[]', '{}', 5)`,
  });
  await client.execute({
    sql: `INSERT INTO oauth_accounts (provider, provider_account_id, user_id, created_at)
          VALUES ('google', 'gid', 'user-1', 1)`,
  });
  await client.execute({
    sql: `INSERT INTO game_sessions
            (id, fen, pgn, turn, status, black_joined, time_control_min, white_ms, black_ms, created_at, updated_at, white_user_id)
          VALUES ('game-1', '8/8/8/8/8/8/8/8 w - - 0 1', '', 'w', 'active', 0, 10, 600000, 600000, 1, 2, 'user-1')`,
  });
}

async function cell(client: Client, sql: string) {
  const result = await client.execute(sql);
  const row = result.rows[0];
  if (!row) return undefined;
  return Object.values(row)[0];
}

function assertNoSecrets(lines: string[]) {
  const text = lines.join("\n");
  expect(text).not.toContain(TOKEN);
  expect(text).not.toContain(REMOTE_URL);
  expect(text).not.toContain("libsql://");
  expect(text).not.toContain("authToken");
}

async function runAgainst(
  client: Client,
  options: { confirm?: string; apply?: boolean; backupDone?: boolean; sql?: string },
) {
  const lines = capture();
  const openClient = vi.fn(() => client);
  const code = await runSeedRemote({
    url: REMOTE_URL,
    authToken: TOKEN,
    confirm: options.confirm,
    apply: options.apply ?? false,
    backupDone: options.backupDone ?? false,
    sql: options.sql ?? contentSeed(),
    openClient,
  });
  return { code, lines, openClient };
}

describe("databaseHostname", () => {
  it("returns only the hostname", () => {
    expect(databaseHostname(REMOTE_URL)).toBe(HOST);
    expect(databaseHostname("libsql://user:token@My-DB.turso.io:443/db")).toBe(
      "My-DB.turso.io",
    );
    expect(databaseHostname("file:/tmp/local.db")).toBeNull();
    expect(databaseHostname("")).toBeNull();
  });
});

describe("seed guard", () => {
  it("refuses a missing CONFIRM before connecting", async () => {
    const lines = capture();
    const openClient = vi.fn(() => {
      throw new Error(`opened ${REMOTE_URL} ${TOKEN}`);
    });
    const code = await runSeedRemote({
      url: REMOTE_URL,
      authToken: TOKEN,
      confirm: undefined,
      openClient,
      sql: "DROP TABLE game_sessions",
    });
    expect(code).toBe(1);
    expect(openClient).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain(`Hostname: ${HOST}`);
    assertNoSecrets(lines);
  });

  it("refuses a mismatched CONFIRM before connecting", async () => {
    const lines = capture();
    const openClient = vi.fn(() => {
      throw new Error(`opened ${REMOTE_URL} ${TOKEN}`);
    });
    const code = await runSeedRemote({
      url: REMOTE_URL,
      authToken: TOKEN,
      confirm: "other.example",
      openClient,
    });
    expect(code).toBe(1);
    expect(openClient).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain(`Hostname: ${HOST}`);
    assertNoSecrets(lines);
  });

  it("dry run writes nothing and prints per-table counts", async () => {
    const { client, dispose } = migratedFile();
    await seedFixtures(client);
    const { code, lines, openClient } = await runAgainst(client, { confirm: HOST });
    expect(code).toBe(0);
    expect(openClient).toHaveBeenCalledTimes(1);
    const text = lines.join("\n");
    expect(text).toContain(`Dry run against ${HOST}.`);
    expect(text).toContain("semesters: 1");
    expect(text).toContain("classes: 1");
    expect(text).toContain("lessons: 1");
    expect(text).toContain("homework_lessons: 1");
    expect(text).toContain("No writes were made.");
    expect(text).toContain("turso db shell");
    expect(text).toContain("point-in-time");
    assertNoSecrets(lines);
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-keep'"),
    ).toBe("Old title");
    expect(await cell(client, "SELECT COUNT(*) AS c FROM game_sessions")).toBe(1);
    expect(
      await cell(client, "SELECT fen FROM game_sessions WHERE id = 'game-1'"),
    ).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
    await dispose();
  });

  it("refuses --apply without --backup-done and writes nothing", async () => {
    const { client, dispose } = migratedFile();
    await seedFixtures(client);
    const { code, lines } = await runAgainst(client, { confirm: HOST, apply: true });
    expect(code).toBe(1);
    const text = lines.join("\n");
    expect(text).toContain("turso db shell");
    expect(text).toContain("point-in-time");
    expect(text).toContain("--backup-done");
    expect(text).toContain("No writes were made.");
    assertNoSecrets(lines);
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-keep'"),
    ).toBe("Old title");
    expect(await cell(client, "SELECT COUNT(*) AS c FROM game_sessions")).toBe(1);
    await dispose();
  });

  it("upserts on --apply --backup-done, is idempotent, and keeps game_sessions", async () => {
    const { client, dispose } = migratedFile();
    await seedFixtures(client);
    const first = await runAgainst(client, {
      confirm: HOST,
      apply: true,
      backupDone: true,
    });
    expect(first.code).toBe(0);
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-keep'"),
    ).toBe("New title");
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-stale'"),
    ).toBe("Stale");
    expect(await cell(client, "SELECT COUNT(*) AS c FROM lessons")).toBe(2);
    expect(await cell(client, "SELECT COUNT(*) AS c FROM homework_lessons")).toBe(1);
    expect(await cell(client, "SELECT xp FROM progress WHERE user_id = 'user-1'")).toBe(
      42,
    );
    expect(await cell(client, "SELECT COUNT(*) AS c FROM users")).toBe(1);
    expect(await cell(client, "SELECT COUNT(*) AS c FROM oauth_accounts")).toBe(1);
    expect(
      await cell(client, "SELECT fen FROM game_sessions WHERE id = 'game-1'"),
    ).toBe("8/8/8/8/8/8/8/8 w - - 0 1");

    const second = await runAgainst(client, {
      confirm: HOST,
      apply: true,
      backupDone: true,
    });
    expect(second.code).toBe(0);
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-keep'"),
    ).toBe("New title");
    expect(await cell(client, "SELECT COUNT(*) AS c FROM lessons")).toBe(2);
    expect(await cell(client, "SELECT COUNT(*) AS c FROM classes")).toBe(1);
    expect(await cell(client, "SELECT COUNT(*) AS c FROM semesters")).toBe(1);
    expect(await cell(client, "SELECT COUNT(*) AS c FROM game_sessions")).toBe(1);
    expect(await cell(client, "SELECT xp FROM progress WHERE user_id = 'user-1'")).toBe(
      42,
    );
    assertNoSecrets(first.lines);
    assertNoSecrets(second.lines);
    await dispose();
  });

  it("refuses an unmigrated database before writing", async () => {
    const { client, dispose } = migratedFile();
    await seedFixtures(client);
    await client.execute('DELETE FROM "__drizzle_migrations"');
    const emptied = await runAgainst(client, {
      confirm: HOST,
      apply: true,
      backupDone: true,
    });
    expect(emptied.code).toBe(1);
    expect(emptied.lines.join("\n")).toContain("no __drizzle_migrations row");
    expect(
      await cell(client, "SELECT title FROM lessons WHERE id = 'lesson-keep'"),
    ).toBe("Old title");
    expect(await cell(client, "SELECT COUNT(*) AS c FROM game_sessions")).toBe(1);

    await client.execute('DROP TABLE "__drizzle_migrations"');
    const dropped = await runAgainst(client, {
      confirm: HOST,
      apply: true,
      backupDone: true,
    });
    expect(dropped.code).toBe(1);
    expect(
      await cell(client, "SELECT fen FROM game_sessions WHERE id = 'game-1'"),
    ).toBe("8/8/8/8/8/8/8/8 w - - 0 1");
    assertNoSecrets(emptied.lines);
    await dispose();
  });

  it("refuses seed SQL that is not a content upsert and does not connect", async () => {
    const lines = capture();
    const openClient = vi.fn(() => {
      throw new Error("should not connect");
    });
    const code = await runSeedRemote({
      url: REMOTE_URL,
      authToken: TOKEN,
      confirm: HOST,
      apply: true,
      backupDone: true,
      sql: "DROP TABLE game_sessions;",
      openClient,
    });
    expect(code).toBe(1);
    expect(openClient).not.toHaveBeenCalled();
    expect(lines.join("\n")).toContain("not a content-table upsert");
    assertNoSecrets(lines);
  });

  it("redacts the url and token from thrown errors", () => {
    const text = redactSecrets(`failed ${REMOTE_URL} token ${TOKEN}`, [
      REMOTE_URL,
      TOKEN,
    ]);
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("libsql://");
    expect(text).toContain("[redacted]");
  });
});

describe("content dump", () => {
  it("emits idempotent content upserts and no user tables", () => {
    const db = new Database(":memory:");
    db.exec(`
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
      CREATE TABLE game_sessions (id text PRIMARY KEY, fen text NOT NULL);
      INSERT INTO semesters VALUES ('sem-1','Sem','','#000','elementary',0);
      INSERT INTO classes VALUES ('class-1','sem-1','Class','♟️','',1,NULL,0);
      INSERT INTO lessons VALUES ('lesson-keep','class-1','Title','','♟️','drill',20,0,'[]','[]',0);
      INSERT INTO homework_lessons VALUES ('hw-1','warmup','Warmup','','♟️','drill',20,'[]',0);
      INSERT INTO game_sessions VALUES ('game-1','fen');
    `);
    const { sql, counts } = renderContentSeed(db);
    db.close();
    expect(counts).toEqual({
      semesters: 1,
      classes: 1,
      lessons: 1,
      homework_lessons: 1,
    });
    const statements = sql
      .split("\n")
      .filter((line) => line.startsWith("INSERT INTO "));
    const body = statements.join("\n");
    expect(body).not.toMatch(/^DROP /m);
    expect(body).not.toMatch(/^CREATE /m);
    expect(body).not.toMatch(/^DELETE /m);
    expect(body).not.toContain("game_sessions");
    expect(body).not.toContain("oauth_accounts");
    expect(body).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(sql).toContain("'lesson-keep'");
    const loaded = loadContentSeed(sql);
    expect(loaded.counts.lessons).toBe(1);
    for (const table of CONTENT_TABLES) expect(loaded.counts[table]).toBe(1);
  });
});

describe("seed-remote CLI", () => {
  function cli(args: string[], extra: Record<string, string | undefined>) {
    const env = { ...process.env };
    delete env.DATABASE_URL;
    delete env.DATABASE_AUTH_TOKEN;
    delete env.CONFIRM;
    for (const [key, value] of Object.entries(extra)) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    return spawnSync(process.execPath, ["scripts/seed-remote.mjs", ...args], {
      cwd: process.cwd(),
      env,
      encoding: "utf8",
      timeout: 5000,
    });
  }

  it("exits when CONFIRM is missing and does not print the token", () => {
    const result = cli([], {
      DATABASE_URL: "libsql://127.0.0.1:9/chess",
      DATABASE_AUTH_TOKEN: TOKEN,
    });
    expect(result.status).toBe(1);
    const text = `${result.stdout}${result.stderr}`;
    expect(text).toContain("Hostname: 127.0.0.1");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("libsql://");
  });

  it("exits when CONFIRM does not match the hostname", () => {
    const result = cli([], {
      DATABASE_URL: "libsql://127.0.0.1:9/chess",
      DATABASE_AUTH_TOKEN: TOKEN,
      CONFIRM: "other.example",
    });
    expect(result.status).toBe(1);
    const text = `${result.stdout}${result.stderr}`;
    expect(text).toContain("Hostname: 127.0.0.1");
    expect(text).not.toContain(TOKEN);
    expect(text).not.toContain("libsql://");
  });

  it("prints help without connecting", () => {
    const result = cli(["--help"], {
      DATABASE_URL: "libsql://127.0.0.1:9/chess",
      DATABASE_AUTH_TOKEN: TOKEN,
    });
    expect(result.status).toBe(0);
    expect(result.stdout).toContain("--backup-done");
    expect(`${result.stdout}${result.stderr}`).not.toContain(TOKEN);
  });
});

describe("committed seed.sql", () => {
  it("is content upserts only, with the snapshot counts", () => {
    const raw = readFileSync(join(process.cwd(), "db/seed.sql"), "utf8");
    const loaded = loadContentSeed(raw);
    expect(loaded.counts).toEqual({
      semesters: 73,
      classes: 2868,
      lessons: 53357,
      homework_lessons: 72,
    });
    expect(raw).toContain("'pre-board-intro'");
    expect(raw).not.toMatch(/^(DROP|CREATE|DELETE|PRAGMA) /m);
  });
});
