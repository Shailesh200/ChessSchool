/**
 * @vitest-environment node
 */
import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient, type Client } from "@libsql/client";
import bcrypt from "bcryptjs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PRODUCTION_DB_HOSTS } from "../db/production-db-hosts.mjs";
import { bootApiTestEnv, bearer, readJson, testIp } from "@/lib/test-db.harness";
import {
  ALEX_LESSONS,
  ALEX_STREAK,
  ALEX_XP,
  STORE_SHOT_ENV_PATH,
  TEST_USER_EMAIL,
  TEST_USER_ID,
  TEST_USER_NAME,
  TEST_USER_PASSWORD,
  TEST_USER_STUDENT_NO,
  assertLocalSeedTarget,
  seedTestUser,
  storeShotLogin,
  writeStoreShotEnv,
} from "./seed-test-user.mjs";

const PROD = PRODUCTION_DB_HOSTS[0]!;
const TOKEN = "fixture-token-do-not-print";
const scriptPath = fileURLToPath(new URL("./seed-test-user.mjs", import.meta.url));
const webRoot = fileURLToPath(new URL("..", import.meta.url));

const MEMORY_SCHEMA = `
CREATE TABLE users (
  id text PRIMARY KEY NOT NULL,
  email text NOT NULL UNIQUE,
  password_hash text,
  name text NOT NULL,
  role text NOT NULL DEFAULT 'student',
  created_at integer NOT NULL
);
CREATE TABLE profiles (
  user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  student_no text NOT NULL,
  enrolled_at integer NOT NULL,
  rank_title text NOT NULL DEFAULT 'Novice',
  avatar_url text,
  goal text,
  house text,
  onboarded integer NOT NULL DEFAULT 0
);
CREATE TABLE progress (
  user_id text PRIMARY KEY NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  xp integer NOT NULL DEFAULT 0,
  streak integer NOT NULL DEFAULT 0,
  last_active_day text,
  daily_goal_xp integer NOT NULL DEFAULT 50,
  graduated_classes text NOT NULL DEFAULT '[]',
  data text NOT NULL DEFAULT '{}',
  updated_at integer NOT NULL DEFAULT 0
);
CREATE TABLE lesson_records (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  mastery real NOT NULL DEFAULT 0,
  attempts integer NOT NULL DEFAULT 0,
  last_seen integer NOT NULL DEFAULT 0,
  due_at integer NOT NULL DEFAULT 0
);
`;

/** Same curve as the home header (`xpProgress` / mobile TopBar). */
function xpBar(xp: number): { level: number; into: number; need: number } {
  let level = 1;
  let need = 100;
  let acc = 0;
  while (xp >= acc + need) {
    acc += need;
    level += 1;
    need = 100 + (level - 1) * 50;
  }
  return { level, into: xp - acc, need };
}

function scriptEnv(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env };
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return env;
}

function runScript(env: NodeJS.ProcessEnv) {
  return new Promise<{ code: number | null; stdout: string; stderr: string }>(
    (resolveRun, reject) => {
      const child = spawn(process.execPath, [scriptPath], {
        cwd: webRoot,
        env,
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
      const timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error("seed script timed out"));
      }, 20_000);
      child.on("error", (err) => {
        clearTimeout(timer);
        reject(err);
      });
      child.on("close", (code) => {
        clearTimeout(timer);
        resolveRun({ code, stdout, stderr });
      });
    },
  );
}

function assertStoreShotFile(filePath: string, email: string, password: string) {
  expect(readFileSync(filePath, "utf8")).toBe(
    `STORE_SHOT_EMAIL=${email}\nSTORE_SHOT_PASSWORD=${password}\n`,
  );
  expect(statSync(filePath).mode & 0o777).toBe(0o600);
}

function expectNoSecrets(output: string, url: string) {
  expect(output).not.toContain(TOKEN);
  expect(output).not.toContain(url);
  expect(output).not.toContain("libsql://");
  expect(output).not.toContain(TEST_USER_PASSWORD);
}

describe("test-user seed guard", () => {
  it("allows only local targets", () => {
    expect(assertLocalSeedTarget(undefined).ok).toBe(true);
    expect(assertLocalSeedTarget("").ok).toBe(true);
    expect(assertLocalSeedTarget("   ").ok).toBe(true);
    const fallback = assertLocalSeedTarget(undefined);
    if (!fallback.ok) throw new Error("default target should be local");
    expect(fallback.url.startsWith("file:")).toBe(true);
    expect(fallback.url.endsWith(`${path.sep}local.db`)).toBe(true);

    for (const url of [
      "file:local.db",
      "file:/tmp/alex.db",
      ":memory:",
      "file::memory:",
      "http://127.0.0.1:8080/db",
      "http://localhost/db",
      "HTTP://LocalHost/db",
      "libsql://127.0.0.1:8080/db",
      "https://localhost",
      "local.db",
    ]) {
      const decision = assertLocalSeedTarget(url);
      expect(decision.ok, url).toBe(true);
    }

    const bare = assertLocalSeedTarget("local.db");
    if (!bare.ok) throw new Error("bare path should be a local file");
    expect(bare.url).toBe("file:local.db");
  });

  it("refuses a production host even on a file URL, without leaking secrets", () => {
    const urls = [
      `libsql://ignored:${TOKEN}@${PROD}/chessschool?authToken=${TOKEN}`,
      `https://user:${TOKEN}@${PROD}./db`,
      `file://${PROD}/tmp/alex.db`,
    ];
    for (const url of urls) {
      const decision = assertLocalSeedTarget(url);
      expect(decision.ok).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toBe("production");
      expect(decision.hostname).toBe(PROD);
      expect(decision.message).toMatch(/production host/);
      expect(decision.message).toContain(PROD);
      expectNoSecrets(decision.message, url);
    }
  });

  it("refuses a non-local remote URL that is not production", () => {
    const urls = [
      `libsql://ignored:${TOKEN}@staging-preview.example.net/chess`,
      "https://example.com/db",
      "http://10.1.2.3/db",
      "libsql://",
    ];
    for (const url of urls) {
      const decision = assertLocalSeedTarget(url);
      expect(decision.ok, url).toBe(false);
      if (decision.ok) continue;
      expect(decision.reason).toBe("remote");
      expect(decision.message).toMatch(/not a local database/);
      expect(decision.message).not.toMatch(/production host/);
      expectNoSecrets(decision.message, url);
    }
    const named = assertLocalSeedTarget(
      "libsql://ignored:fixture-token-do-not-print@staging-preview.example.net/chess",
    );
    if (named.ok) throw new Error("remote host should be refused");
    expect(named.hostname).toBe("staging-preview.example.net");
  });

  it("the CLI exits non-zero for a production host and does not print secrets", async () => {
    const url = `libsql://ignored:${TOKEN}@${PROD}/chessschool?authToken=${TOKEN}`;
    const result = await runScript(
      scriptEnv({ DATABASE_URL: url, DATABASE_AUTH_TOKEN: TOKEN }),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/production host/);
    expect(result.stderr).toContain(PROD);
    expectNoSecrets(`${result.stdout}\n${result.stderr}`, url);
  });

  it("the CLI exits non-zero for a non-local remote URL and does not print secrets", async () => {
    const url = `libsql://ignored:${TOKEN}@staging-preview.example.net/chess`;
    const result = await runScript(
      scriptEnv({ DATABASE_URL: url, DATABASE_AUTH_TOKEN: TOKEN }),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toMatch(/not a local database/);
    expect(result.stderr).toContain("staging-preview.example.net");
    expect(result.stderr).not.toMatch(/production host/);
    expectNoSecrets(`${result.stdout}\n${result.stderr}`, url);
  });

  it("falls back to the made-up defaults when the shot env vars are unset", () => {
    expect(storeShotLogin({})).toEqual({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    expect(
      storeShotLogin({ STORE_SHOT_EMAIL: "   ", STORE_SHOT_PASSWORD: "" }),
    ).toEqual({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });
    expect(storeShotLogin({ STORE_SHOT_PASSWORD: "OnlyPassword1" })).toEqual({
      email: TEST_USER_EMAIL,
      password: "OnlyPassword1",
    });
  });

  it("writes STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD with mode 0600", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "store-shot-"));
    const file = path.join(dir, ".store-shot.env");
    try {
      writeFileSync(file, "OLD=1\n", { mode: 0o644 });
      writeStoreShotEnv(file, {
        email: "shot.user@store-shot.test",
        password: "StoreShotEnv1",
      });
      assertStoreShotFile(file, "shot.user@store-shot.test", "StoreShotEnv1");
      expect(readFileSync(file, "utf8")).not.toContain("OLD=");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps Alex out of the main seed files", () => {
    const seedSql = readFileSync(path.join(webRoot, "db", "seed.sql"), "utf8");
    const seedScript = readFileSync(path.join(webRoot, "scripts", "seed.mjs"), "utf8");
    expect(seedSql.includes(TEST_USER_EMAIL)).toBe(false);
    expect(seedSql.includes(TEST_USER_PASSWORD)).toBe(false);
    expect(seedScript.includes(TEST_USER_EMAIL)).toBe(false);
    expect(seedScript.includes(TEST_USER_PASSWORD)).toBe(false);
  });
});

describe("test-user seed", () => {
  const open: Client[] = [];

  afterEach(() => {
    for (const client of open.splice(0)) client.close();
  });

  it("succeeds on an in-memory database and is idempotent", async () => {
    const client = createClient({ url: ":memory:" });
    open.push(client);
    await client.executeMultiple(MEMORY_SCHEMA);
    await client.execute("PRAGMA foreign_keys = ON");

    await seedTestUser(client, storeShotLogin({}));
    await client.execute({
      sql: `INSERT INTO lesson_records (
              id, user_id, lesson_id, mastery, attempts, last_seen, due_at
            ) VALUES ('extra', ?, 'not-a-fixture', 0.2, 3, 0, 0)`,
      args: [TEST_USER_ID],
    });
    const before = await client.execute({
      sql: "SELECT id, created_at, password_hash FROM users WHERE email = ?",
      args: [TEST_USER_EMAIL],
    });
    await seedTestUser(client, storeShotLogin({}));

    const users = await client.execute({
      sql: "SELECT id, email, name, role, created_at, password_hash FROM users WHERE email = ?",
      args: [TEST_USER_EMAIL],
    });
    expect(users.rows).toHaveLength(1);
    const user = users.rows[0] as Record<string, unknown>;
    expect(user.id).toBe(TEST_USER_ID);
    expect(user.id).toBe((before.rows[0] as Record<string, unknown>).id);
    expect(user.created_at).toBe(
      (before.rows[0] as Record<string, unknown>).created_at,
    );
    expect(user.email).toBe(TEST_USER_EMAIL);
    expect(user.name).toBe(TEST_USER_NAME);
    expect(user.role).toBe("student");
    const hash = String(user.password_hash);
    expect(hash).toMatch(/^\$2[ab]\$10\$/);
    expect(await bcrypt.compare(TEST_USER_PASSWORD, hash)).toBe(true);

    const profile = (
      await client.execute({
        sql: "SELECT student_no, rank_title, onboarded, goal, avatar_url FROM profiles WHERE user_id = ?",
        args: [TEST_USER_ID],
      })
    ).rows[0] as Record<string, unknown>;
    expect(profile.student_no).toBe(TEST_USER_STUDENT_NO);
    expect(profile.rank_title).toBe("Novice");
    expect(Number(profile.onboarded)).toBe(1);
    expect(profile.goal).toBeNull();
    expect(profile.avatar_url).toBeNull();

    const progress = (
      await client.execute({
        sql: "SELECT xp, streak, last_active_day, graduated_classes, data FROM progress WHERE user_id = ?",
        args: [TEST_USER_ID],
      })
    ).rows[0] as Record<string, unknown>;
    expect(Number(progress.xp)).toBe(ALEX_XP);
    expect(Number(progress.streak)).toBe(ALEX_STREAK);
    expect(progress.streak).not.toBe(0);
    expect(String(progress.last_active_day)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(progress.graduated_classes).toBe("[]");
    const data = JSON.parse(String(progress.data)) as {
      settings?: unknown;
      activityDays?: Record<string, number>;
    };
    expect(data.settings).toBeUndefined();
    const earned = Object.values(data.activityDays ?? {}).reduce(
      (sum, xp) => sum + xp,
      0,
    );
    expect(earned).toBe(ALEX_XP);
    const bar = xpBar(Number(progress.xp));
    expect(bar.level).toBe(1);
    expect(bar.into).toBeGreaterThan(0);
    expect(bar.into).toBeLessThan(bar.need);

    const lessons = await client.execute({
      sql: "SELECT lesson_id, mastery, attempts FROM lesson_records WHERE user_id = ? ORDER BY lesson_id",
      args: [TEST_USER_ID],
    });
    expect(
      lessons.rows.map((row) => (row as Record<string, unknown>).lesson_id),
    ).toEqual(ALEX_LESSONS.map((lesson) => lesson.id).sort());
    for (const row of lessons.rows) {
      const lesson = row as Record<string, unknown>;
      expect(Number(lesson.mastery)).toBe(1);
      expect(Number(lesson.attempts)).toBe(1);
    }
  });

  it("uses STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD when they are set", async () => {
    const client = createClient({ url: ":memory:" });
    open.push(client);
    await client.executeMultiple(MEMORY_SCHEMA);
    const login = storeShotLogin({
      STORE_SHOT_EMAIL: "  Shot.User@store-shot.test ",
      STORE_SHOT_PASSWORD: "StoreShotEnv1",
    });
    expect(login).toEqual({
      email: "shot.user@store-shot.test",
      password: "StoreShotEnv1",
    });

    await seedTestUser(client, storeShotLogin({}));
    await seedTestUser(client, login);

    const users = await client.execute("SELECT id, email, password_hash FROM users");
    expect(users.rows).toHaveLength(1);
    const user = users.rows[0] as Record<string, unknown>;
    expect(user.id).toBe(TEST_USER_ID);
    expect(user.email).toBe(login.email);
    expect(await bcrypt.compare(login.password, String(user.password_hash))).toBe(true);
    expect(await bcrypt.compare(TEST_USER_PASSWORD, String(user.password_hash))).toBe(
      false,
    );
  });

  it("seeds a local file, logs in through the login route, and the CLI is idempotent", async () => {
    vi.resetModules();
    const previousUrl = process.env.DATABASE_URL;
    const env = await bootApiTestEnv();
    try {
      const client = (env.db as unknown as { $client: Client }).$client;
      await seedTestUser(client, storeShotLogin({}));
      await seedTestUser(client, storeShotLogin({}));

      const count = await client.execute({
        sql: "SELECT COUNT(*) AS c FROM users WHERE email = ?",
        args: [TEST_USER_EMAIL],
      });
      expect(Number((count.rows[0] as Record<string, unknown>).c)).toBe(1);

      const postLogin = (await import("@/app/api/auth/login/route")).POST;
      const getProgress = (await import("@/app/api/progress/route")).GET;
      const login = await postLogin(
        new Request("http://test/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", ...testIp(210) },
          body: JSON.stringify({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
          }),
        }),
      );
      expect(login.status).toBe(200);
      const session = await readJson<{
        token: string;
        user: { name: string; email: string };
      }>(login);
      expect(session.user).toMatchObject({
        email: TEST_USER_EMAIL,
        name: TEST_USER_NAME,
      });
      expect(session.token.length).toBeGreaterThan(10);

      const progressRes = await getProgress(
        new Request("http://test/api/progress", { headers: bearer(session.token) }),
      );
      expect(progressRes.status).toBe(200);
      const progress = await readJson<{
        xp: number;
        streak: number;
        settings: unknown;
        lessons: Record<string, { mastery: number }>;
      }>(progressRes);
      expect(progress.xp).toBe(ALEX_XP);
      expect(progress.streak).toBe(ALEX_STREAK);
      expect(progress.settings).toBeNull();
      expect(Object.keys(progress.lessons).sort()).toEqual(
        ALEX_LESSONS.map((lesson) => lesson.id).sort(),
      );
      const bar = xpBar(progress.xp);
      expect(bar.into).toBeGreaterThan(0);
      expect(bar.into).toBeLessThan(bar.need);

      const fileUrl = process.env.DATABASE_URL;
      expect(fileUrl?.startsWith("file:")).toBe(true);
      for (let i = 0; i < 2; i++) {
        const result = await runScript(
          scriptEnv({
            DATABASE_URL: fileUrl,
            DATABASE_AUTH_TOKEN: undefined,
            STORE_SHOT_EMAIL: undefined,
            STORE_SHOT_PASSWORD: undefined,
          }),
        );
        expect(result.code).toBe(0);
        expect(result.stdout.trim()).toBe(`test user seeded ${TEST_USER_ID}`);
        expect(result.stdout).not.toContain(TEST_USER_EMAIL);
        expect(result.stdout).not.toContain(TEST_USER_PASSWORD);
        expect(result.stderr).not.toContain(TEST_USER_EMAIL);
        expect(result.stderr).not.toContain(TEST_USER_PASSWORD);
        if (fileUrl) expectNoSecrets(`${result.stdout}\n${result.stderr}`, fileUrl);
      }
      assertStoreShotFile(STORE_SHOT_ENV_PATH, TEST_USER_EMAIL, TEST_USER_PASSWORD);

      const again = await client.execute({
        sql: "SELECT COUNT(*) AS c FROM users WHERE email = ?",
        args: [TEST_USER_EMAIL],
      });
      expect(Number((again.rows[0] as Record<string, unknown>).c)).toBe(1);
      const xp = await client.execute({
        sql: "SELECT xp, streak FROM progress WHERE user_id = ?",
        args: [TEST_USER_ID],
      });
      expect(Number((xp.rows[0] as Record<string, unknown>).xp)).toBe(ALEX_XP);
      expect(Number((xp.rows[0] as Record<string, unknown>).streak)).toBe(ALEX_STREAK);

      const relogin = await postLogin(
        new Request("http://test/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", ...testIp(211) },
          body: JSON.stringify({
            email: TEST_USER_EMAIL,
            password: TEST_USER_PASSWORD,
          }),
        }),
      );
      expect(relogin.status).toBe(200);

      const shotEmail = "Shot.User@store-shot.test";
      const shotPassword = "StoreShotEnv1";
      const shot = await runScript(
        scriptEnv({
          DATABASE_URL: fileUrl,
          DATABASE_AUTH_TOKEN: undefined,
          STORE_SHOT_EMAIL: `  ${shotEmail} `,
          STORE_SHOT_PASSWORD: shotPassword,
        }),
      );
      expect(shot.code).toBe(0);
      expect(shot.stdout.trim()).toBe(`test user seeded ${TEST_USER_ID}`);
      expect(`${shot.stdout}\n${shot.stderr}`).not.toContain(shotEmail);
      expect(`${shot.stdout}\n${shot.stderr}`).not.toContain(
        "shot.user@store-shot.test",
      );
      expect(`${shot.stdout}\n${shot.stderr}`).not.toContain(shotPassword);
      assertStoreShotFile(
        STORE_SHOT_ENV_PATH,
        "shot.user@store-shot.test",
        shotPassword,
      );
      const shotLogin = await postLogin(
        new Request("http://test/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json", ...testIp(212) },
          body: JSON.stringify({
            email: "shot.user@store-shot.test",
            password: shotPassword,
          }),
        }),
      );
      expect(shotLogin.status).toBe(200);
      const stillOne = await client.execute({
        sql: "SELECT COUNT(*) AS c FROM users",
        args: [],
      });
      expect(Number((stillOne.rows[0] as Record<string, unknown>).c)).toBe(1);
    } finally {
      env.teardown();
      rmSync(STORE_SHOT_ENV_PATH, { force: true });
      if (previousUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousUrl;
      vi.resetModules();
    }
  }, 90_000);
});
