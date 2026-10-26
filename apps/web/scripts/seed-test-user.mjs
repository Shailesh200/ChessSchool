/**
 * Upsert the made-up Play Store screenshot student "Alex".
 *
 * Test-only. Alex is not in `db/seed.sql` or `scripts/seed.mjs`.
 * Refuses every non-local database and every production host.
 * Prints neither the login, DATABASE_URL, nor the auth token.
 *
 *   pnpm --filter web db:seed:test-user
 *   pnpm db:seed:test-user
 *
 * Login comes from STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD when those are
 * set. Otherwise the made-up defaults below are used. After a successful
 * seed the values used are written to apps/web/.store-shot.env (mode 0600).
 *
 * Requires the local schema (`pnpm --filter web db:push` or `db:fresh`).
 */
import { createClient } from "@libsql/client";
import { chmodSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { isProductionDbHost } from "../db/production-db-hosts.mjs";
import { hashPassword } from "../lib/password-hash.mjs";

const WEB_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

/** Unset DATABASE_URL → the web package's local SQLite file. */
export const DEFAULT_LOCAL_DATABASE_URL = `file:${path.join(WEB_ROOT, "local.db")}`;

export const TEST_USER_ID = "user-alex-play-store";
/** Made-up default used when STORE_SHOT_EMAIL is unset or blank. */
export const TEST_USER_EMAIL = "alex@test.chessschool.local";
/** Made-up default used when STORE_SHOT_PASSWORD is unset or blank. */
export const TEST_USER_PASSWORD = "AlexTestOnly1";
export const TEST_USER_NAME = "Alex";
export const TEST_USER_STUDENT_NO = "CS-TEST-ALEX";

/** Written after a successful seed. Gitignored. */
export const STORE_SHOT_ENV_PATH = path.join(WEB_ROOT, ".store-shot.env");

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

/** libsql: is not a WHATWG scheme. Rewrite only for parsing, never for connecting. */
function parsedDbUrl(url) {
  const parseable = url.toLowerCase().startsWith("libsql:")
    ? `https:${url.slice("libsql:".length)}`
    : url;
  try {
    return new URL(parseable);
  } catch {
    return null;
  }
}

function hostnameOf(parsed) {
  if (!parsed) return "";
  return parsed.hostname.toLowerCase().replace(/\.+$/, "");
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
 * `\` and `@` are refused before parsing. WHATWG reads `localhost\@evil.com`
 * as localhost, and libsql does not, so a host check on `new URL` is not
 * enough. A parsed username or password is refused too.
 *
 * @param {string | undefined | null} rawUrl
 * @returns {SeedTarget}
 */
export function assertLocalSeedTarget(rawUrl) {
  const raw = (rawUrl ?? "").trim();
  if (!raw) return { ok: true, url: DEFAULT_LOCAL_DATABASE_URL };

  if (raw.includes("\\") || raw.includes("@")) return refusal("remote", null);

  if (isMemoryUrl(raw)) return { ok: true, url: raw };

  const scheme = schemeOf(raw);
  if (!scheme) return { ok: true, url: `file:${raw}` };

  const parsed = parsedDbUrl(raw);
  const hostname = hostnameOf(parsed);
  if (hostname && isProductionDbHost(hostname)) return refusal("production", hostname);
  if (parsed && (parsed.username !== "" || parsed.password !== "")) {
    return refusal("remote", null);
  }
  if (scheme === "file") return { ok: true, url: raw };
  if (LOCAL_HOSTS.has(hostname)) return { ok: true, url: raw };
  return refusal("remote", hostname);
}

function nonempty(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Email and password the seed will use. Each env var falls back on its own.
 * Email is lowercased the same way login looks it up.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {{ email: string, password: string }}
 */
export function storeShotLogin(env = process.env) {
  const email = nonempty(env.STORE_SHOT_EMAIL).toLowerCase();
  const password = nonempty(env.STORE_SHOT_PASSWORD);
  return {
    email: email || TEST_USER_EMAIL,
    password: password || TEST_USER_PASSWORD,
  };
}

/**
 * Replace the capture-job env file with the values this seed used.
 * An existing file is removed first so a looser mode cannot stick.
 * The new file is mode 0600. Does not print the values.
 *
 * @param {string} filePath
 * @param {{ email: string, password: string }} login
 */
export function writeStoreShotEnv(filePath, login) {
  if (/[\r\n]/.test(login.email) || /[\r\n]/.test(login.password)) {
    throw new Error(
      "STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD must be single-line values.",
    );
  }
  const body = `STORE_SHOT_EMAIL=${login.email}\nSTORE_SHOT_PASSWORD=${login.password}\n`;
  try {
    unlinkSync(filePath);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code !== "ENOENT") throw error;
  }
  writeFileSync(filePath, body, { encoding: "utf8", mode: 0o600, flag: "w" });
  chmodSync(filePath, 0o600);
}

function secretsFrom(env) {
  const login = storeShotLogin(env);
  const secrets = [TEST_USER_PASSWORD, TEST_USER_EMAIL, login.password, login.email];
  if (env.STORE_SHOT_EMAIL) secrets.push(env.STORE_SHOT_EMAIL);
  if (env.STORE_SHOT_PASSWORD) secrets.push(env.STORE_SHOT_PASSWORD);
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
 * @param {{ email: string, password: string }} [login]
 */
export async function seedTestUser(client, login = storeShotLogin()) {
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
  const { email, password } = login;
  const passwordHash = await hashPassword(password);
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
            ON CONFLICT(id) DO UPDATE SET
              email = excluded.email,
              password_hash = excluded.password_hash,
              name = excluded.name`,
      args: [TEST_USER_ID, email, passwordHash, TEST_USER_NAME, now],
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
      args: [TEST_USER_STUDENT_NO, now, email],
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
      args: [ALEX_XP, ALEX_STREAK, today, data, now, email],
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
      args: [lesson.id, lesson.id, lesson.lastSeen, lesson.dueAt, email],
    });
  }

  const placeholders = ALEX_LESSONS.map(() => "?").join(", ");
  statements.push({
    sql: `DELETE FROM lesson_records
          WHERE user_id = (SELECT id FROM users WHERE email = ?)
            AND lesson_id NOT IN (${placeholders})`,
    args: [email, ...ALEX_LESSONS.map((lesson) => lesson.id)],
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
    const login = storeShotLogin(env);
    await seedTestUser(client, login);
    writeStoreShotEnv(STORE_SHOT_ENV_PATH, login);
    console.log(`test user seeded ${TEST_USER_ID}`);
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
