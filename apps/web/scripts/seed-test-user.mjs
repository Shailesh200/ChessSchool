/**
 * Upsert the made-up Play Store screenshot student "Alex".
 *
 * Test-only. Alex is not in `db/seed.sql` or `scripts/seed.mjs`.
 * Refuses every non-local database and every production host.
 * Prints neither DATABASE_URL nor the auth token.
 *
 *   pnpm --filter web db:seed:test-user
 *   pnpm db:seed:test-user
 *
 * Requires the local schema (`pnpm --filter web db:push` or `db:fresh`).
 * Login (made up): alex@test.chessschool.local / AlexTestOnly1
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProductionDbHost } from "../db/production-db-hosts.mjs";
import { hashPassword } from "../lib/password-hash.mjs";

const WEB_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Unset DATABASE_URL → the web package's local SQLite file. */
export const DEFAULT_LOCAL_DATABASE_URL = `file:${path.join(WEB_ROOT, "local.db")}`;

export const TEST_USER_ID = "user-alex-play-store";
export const TEST_USER_EMAIL = "alex@test.chessschool.local";
export const TEST_USER_PASSWORD = "AlexTestOnly1";
export const TEST_USER_NAME = "Alex";
export const TEST_USER_STUDENT_NO = "CS-TEST-ALEX";

/**
 * First Chess Basics lessons (The Chess Board). XP matches the curriculum
 * values so the home header bar is the same partial fill a real student gets
 * after these lessons (50 / 100 at level 1).
 */
export const ALEX_LESSONS = [
  { id: "pre-board-intro", xp: 15 },
  { id: "pre-board-setup", xp: 15 },
  { id: "pre-square-d5", xp: 10 },
  { id: "pre-square-e4", xp: 10 },
];

export const ALEX_XP = ALEX_LESSONS.reduce((sum, lesson) => sum + lesson.xp, 0);
/** One lesson a day, ending today, so the header streak matches the lessons. */
export const ALEX_STREAK = ALEX_LESSONS.length;

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);
const DAY_MS = 86_400_000;
const REVIEW_DAYS = 14;

const NOT_WRITTEN =
  "No rows were written. The database URL and auth token were not printed.";

/**
 * @typedef {{ ok: true, url: string }} SeedTargetOk
 * @typedef {{ ok: false, reason: "production" | "remote", hostname: string | null, message: string }} SeedTargetNo
 * @typedef {SeedTargetOk | SeedTargetNo} SeedTarget
 */

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  return import.meta.url === pathToFileURL(path.resolve(entry)).href;
}

function schemeOf(url) {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(url);
  return match ? match[0].slice(0, -1).toLowerCase() : "";
}

function hostnameOf(url) {
  let parseable = url;
  if (url.toLowerCase().startsWith("libsql:")) {
    parseable = `https:${url.slice("libsql:".length)}`;
  }
  try {
    return new URL(parseable).hostname.toLowerCase().replace(/\.+$/, "");
  } catch {
    return "";
  }
}

function isMemoryUrl(url) {
  const value = url.trim().toLowerCase();
  return value === ":memory:" || value.startsWith("file::memory:");
}

function isoDay(ms) {
  return new Date(ms).toISOString().slice(0, 10);
}

function addUtcDays(iso, delta) {
  const date = new Date(`${iso}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function refusal(reason, hostname) {
  const where = hostname ? ` (host ${hostname})` : "";
  const lead =
    reason === "production"
      ? `Refusing to seed the test user on production host ${hostname}.`
      : `Refusing to seed the test user: DATABASE_URL is not a local database${where}.`;
  const allow = "Allowed: file: URLs, localhost, 127.0.0.1, and :memory:.";
  return {
    ok: false,
    reason,
    hostname: hostname || null,
    message: `${lead}\n${allow}\n${NOT_WRITTEN}`,
  };
}

/**
 * Local-only allowlist, after the production-host guard.
 * Unset or blank resolves to the web package `local.db`. A scheme-less value
 * is a local file path (same as the app). Hosted URLs must be localhost or
 * 127.0.0.1. Production hosts are refused even on a `file:` URL.
 *
 * @param {string | undefined | null} rawUrl
 * @returns {SeedTarget}
 */
export function assertLocalSeedTarget(rawUrl) {
  const raw = (rawUrl ?? "").trim();
  if (!raw) return { ok: true, url: DEFAULT_LOCAL_DATABASE_URL };

  if (isMemoryUrl(raw)) return { ok: true, url: raw };

  const scheme = schemeOf(raw);
  if (!scheme) return { ok: true, url: `file:${raw}` };

  const hostname = hostnameOf(raw);
  if (hostname && isProductionDbHost(hostname)) return refusal("production", hostname);
  if (scheme === "file") return { ok: true, url: raw };
  if (LOCAL_HOSTS.has(hostname)) return { ok: true, url: raw };
  return refusal("remote", hostname);
}

function secretsFrom(env) {
  const secrets = [TEST_USER_PASSWORD];
  if (env.DATABASE_AUTH_TOKEN) secrets.push(env.DATABASE_AUTH_TOKEN);
  if (env.DATABASE_URL) {
    secrets.push(env.DATABASE_URL);
    const raw = env.DATABASE_URL;
    const parseable = raw.toLowerCase().startsWith("libsql:")
      ? `https:${raw.slice("libsql:".length)}`
      : raw;
    try {
      const parsed = new URL(parseable);
      if (parsed.password) secrets.push(decodeURIComponent(parsed.password));
      if (parsed.username) secrets.push(decodeURIComponent(parsed.username));
    } catch {
      /* unparseable URL — the raw value is already redacted */
    }
  }
  return secrets.filter((secret) => secret.length >= 4);
}

function redact(err, env) {
  let message = err instanceof Error ? err.message : "Could not seed the test user.";
  for (const secret of secretsFrom(env)) {
    message = message.split(secret).join("[redacted]");
  }
  if (
    /:\/\//.test(message) ||
    /authToken|DATABASE_URL|DATABASE_AUTH_TOKEN/i.test(message)
  ) {
    return "Could not seed the test user. The database URL and auth token were not printed.";
  }
  return message;
}

function openLocalClient(url, env) {
  const hosted =
    schemeOf(url) === "libsql" || schemeOf(url) === "https" || schemeOf(url) === "http";
  const token = env.DATABASE_AUTH_TOKEN;
  return createClient({
    url,
    ...(hosted && token ? { authToken: token } : {}),
  });
}

/**
 * Insert or update Alex. Idempotent: one user, fixture XP, streak, and the
 * four board lessons. Does not write a coach (`progress.data` has no settings),
 * and marks the profile onboarded so the app keeps the default coach.
 *
 * @param {{ execute: Function, batch: Function }} client
 */
export async function seedTestUser(client) {
  const existing = await client.execute(
    "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'users'",
  );
  if (existing.rows.length === 0) {
    throw new Error(
      "The users table is missing. Apply the local schema (pnpm --filter web db:push) before seeding the test user.",
    );
  }

  const now = Date.now();
  const today = isoDay(now);
  const passwordHash = await hashPassword(TEST_USER_PASSWORD);
  /** @type {Record<string, number>} */
  const activityDays = {};
  const lessons = ALEX_LESSONS.map((lesson, index) => {
    const daysAgo = ALEX_LESSONS.length - 1 - index;
    activityDays[addUtcDays(today, -daysAgo)] = lesson.xp;
    const lastSeen = now - daysAgo * DAY_MS;
    return { ...lesson, lastSeen, dueAt: lastSeen + REVIEW_DAYS * DAY_MS };
  });
  // No `settings` key — the client keeps the default coach.
  const data = JSON.stringify({
    rating: 800,
    activityDays,
    placementDone: false,
  });

  /** @type {{ sql: string, args: import("@libsql/client").InArgs }[]} */
  const statements = [
    {
      sql: `INSERT INTO users (id, email, password_hash, name, role, created_at)
            VALUES (?, ?, ?, ?, 'student', ?)
            ON CONFLICT(email) DO UPDATE SET
              password_hash = excluded.password_hash,
              name = excluded.name`,
      args: [TEST_USER_ID, TEST_USER_EMAIL, passwordHash, TEST_USER_NAME, now],
    },
    {
      sql: `INSERT INTO profiles (
              user_id, student_no, enrolled_at, rank_title, avatar_url, goal, house, onboarded
            )
            SELECT id, ?, ?, 'Novice', NULL, NULL, NULL, 1
            FROM users WHERE email = ?
            ON CONFLICT(user_id) DO UPDATE SET
              student_no = excluded.student_no,
              rank_title = 'Novice',
              avatar_url = NULL,
              goal = NULL,
              house = NULL,
              onboarded = 1`,
      args: [TEST_USER_STUDENT_NO, now, TEST_USER_EMAIL],
    },
    {
      sql: `INSERT INTO progress (
              user_id, xp, streak, last_active_day, daily_goal_xp,
              graduated_classes, data, updated_at
            )
            SELECT id, ?, ?, ?, 50, '[]', ?, ?
            FROM users WHERE email = ?
            ON CONFLICT(user_id) DO UPDATE SET
              xp = excluded.xp,
              streak = excluded.streak,
              last_active_day = excluded.last_active_day,
              daily_goal_xp = excluded.daily_goal_xp,
              graduated_classes = excluded.graduated_classes,
              data = excluded.data,
              updated_at = excluded.updated_at`,
      args: [ALEX_XP, ALEX_STREAK, today, data, now, TEST_USER_EMAIL],
    },
  ];

  for (const lesson of lessons) {
    statements.push({
      sql: `INSERT INTO lesson_records (
              id, user_id, lesson_id, mastery, attempts, last_seen, due_at
            )
            SELECT id || ':' || ?, id, ?, 1, 1, ?, ?
            FROM users WHERE email = ?
            ON CONFLICT(id) DO UPDATE SET
              mastery = excluded.mastery,
              attempts = excluded.attempts,
              last_seen = excluded.last_seen,
              due_at = excluded.due_at`,
      args: [lesson.id, lesson.id, lesson.lastSeen, lesson.dueAt, TEST_USER_EMAIL],
    });
  }

  const placeholders = ALEX_LESSONS.map(() => "?").join(", ");
  statements.push({
    sql: `DELETE FROM lesson_records
          WHERE user_id = (SELECT id FROM users WHERE email = ?)
            AND lesson_id NOT IN (${placeholders})`,
    args: [TEST_USER_EMAIL, ...ALEX_LESSONS.map((lesson) => lesson.id)],
  });

  await client.batch(statements, "write");
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 * @returns {Promise<number>}
 */
export async function main(env = process.env) {
  const decision = assertLocalSeedTarget(env.DATABASE_URL);
  if (!decision.ok) {
    console.error(decision.message);
    return 1;
  }

  const client = openLocalClient(decision.url, env);
  try {
    if (decision.url.toLowerCase().startsWith("file:")) {
      await client.execute("PRAGMA busy_timeout = 5000");
    }
    await seedTestUser(client);
    console.log(
      `Seeded test user ${TEST_USER_EMAIL} (xp ${ALEX_XP}, streak ${ALEX_STREAK}).`,
    );
    return 0;
  } catch (err) {
    console.error(redact(err, env));
    return 1;
  } finally {
    client.close();
  }
}

if (invokedDirectly()) {
  main()
    .then((code) => {
      process.exit(code);
    })
    .catch((err) => {
      console.error(redact(err, process.env));
      process.exit(1);
    });
}
