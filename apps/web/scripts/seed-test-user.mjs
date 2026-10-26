/**
 * Upsert the made-up Play Store screenshot student "Alex".
 *
 * Test-only. Alex is not in `db/seed.sql.gz` or `scripts/seed.mjs`.
 * Refuses every non-local database and every production host.
 * Prints neither the login, DATABASE_URL, nor the auth token.
 *
 *   pnpm --filter web db:seed:test-user
 *   pnpm db:seed:test-user
 *
 * Login comes from STORE_SHOT_EMAIL and STORE_SHOT_PASSWORD when those are
 * set. Otherwise the made-up defaults below are used. After a successful
 * seed the values used are written to apps/web/.store-shot.env (mode 0600),
 * or to STORE_SHOT_ENV_PATH when that is set. The path is resolved first:
 * its filename must end in `.env` and its directory must already exist.
 * An existing file is replaced only when it is empty or holds only
 * STORE_SHOT_EMAIL= / STORE_SHOT_PASSWORD= lines. A directory at the path
 * is refused. A bad path exits before the database is opened.
 * If the rows are written and the env file still cannot be written, the
 * process exits 1 with a message that does not include the path.
 *
 * Requires the local schema (`pnpm --filter web db:push` or `db:fresh`).
 */
import { createClient } from "@libsql/client";
import {
  accessSync,
  chmodSync,
  constants,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
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

/** Default capture-job env file. Gitignored. Override with STORE_SHOT_ENV_PATH. */
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

/** Lowercased host with trailing dots removed. Production check only. */
function hostnameOf(parsed) {
  if (!parsed) return "";
  return parsed.hostname.toLowerCase().replace(/\.+$/, "");
}

/**
 * Host as written, lowercased, port removed, trailing dots kept.
 * WHATWG drops the dot on `127.0.0.1.` and keeps it on `localhost.`, so the
 * allowlist cannot use `URL.hostname`.
 *
 * @param {string} url
 * @returns {string}
 */
function rawHost(url) {
  const scheme = schemeOf(url);
  const afterScheme = url.slice(scheme.length + 1);
  const authority = afterScheme.startsWith("//") ? afterScheme.slice(2) : afterScheme;
  const end = authority.search(/[/?#]/);
  const auth = end === -1 ? authority : authority.slice(0, end);
  if (!auth) return "";
  if (auth.startsWith("[")) {
    const bracket = auth.indexOf("]");
    return (bracket === -1 ? auth : auth.slice(0, bracket + 1)).toLowerCase();
  }
  const colon = auth.lastIndexOf(":");
  const host =
    colon !== -1 && /^\d+$/.test(auth.slice(colon + 1)) ? auth.slice(0, colon) : auth;
  return host.toLowerCase();
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
 * enough. A parsed username or password is refused too. The local allowlist
 * compares the raw host, so `localhost.` and `127.0.0.1.` are not local.
 * Trailing dots are stripped only for the production-host check.
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
  const productionHost = hostnameOf(parsed);
  if (productionHost && isProductionDbHost(productionHost)) {
    return refusal("production", productionHost);
  }
  if (parsed && (parsed.username !== "" || parsed.password !== "")) {
    return refusal("remote", null);
  }
  if (scheme === "file") return { ok: true, url: raw };
  const host = rawHost(raw);
  if (LOCAL_HOSTS.has(host)) return { ok: true, url: raw };
  return refusal("remote", host);
}

function nonempty(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Where the capture-job env file is written. `STORE_SHOT_ENV_PATH` overrides
 * the default `apps/web/.store-shot.env`. A blank override is ignored.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function storeShotEnvPath(env = process.env) {
  const chosen = nonempty(env.STORE_SHOT_ENV_PATH) || STORE_SHOT_ENV_PATH;
  return path.resolve(chosen);
}

/**
 * An existing capture-job file may be replaced only when every non-blank line
 * is `STORE_SHOT_EMAIL=` or `STORE_SHOT_PASSWORD=`. Anything else (a mobile
 * `.env`, `prod.env`, comments) is left untouched.
 *
 * @param {string} content
 */
function isReplaceableStoreShotEnv(content) {
  for (const line of content.split(/\r?\n/)) {
    if (line.trim() === "") continue;
    if (
      line.startsWith("STORE_SHOT_EMAIL=") ||
      line.startsWith("STORE_SHOT_PASSWORD=")
    ) {
      continue;
    }
    return false;
  }
  return true;
}

/**
 * Resolve the capture-job env file and refuse a path that cannot be written.
 * Parent stat failures, and path stat failures other than a missing file, are
 * the same refusal. Call this before opening the database. Does not print the path.
 *
 * @param {Record<string, string | undefined>} [env]
 * @returns {string}
 */
export function resolveStoreShotEnvPath(env = process.env) {
  const filePath = storeShotEnvPath(env);
  if (!path.basename(filePath).endsWith(".env")) {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH must end in .env. No rows were written.",
    );
  }
  const parent = path.dirname(filePath);
  let parentStat;
  try {
    parentStat = statSync(parent);
  } catch {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  if (!parentStat.isDirectory()) {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  try {
    accessSync(parent, constants.W_OK);
  } catch {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  let current;
  try {
    current = statSync(filePath);
  } catch (error) {
    if (/** @type {NodeJS.ErrnoException} */ (error).code === "ENOENT") return filePath;
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  if (!current.isFile()) {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  let content;
  try {
    content = readFileSync(filePath, "utf8");
  } catch {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH cannot be written. No rows were written.",
    );
  }
  if (!isReplaceableStoreShotEnv(content)) {
    throw new Error(
      "Refusing to seed the test user: STORE_SHOT_ENV_PATH already holds other content. No rows were written.",
    );
  }
  return filePath;
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
 * The replacement is created with flag wx and mode 0600. Any failure,
 * including EEXIST, EACCES, ENOSPC, and EROFS, is reported without the path.
 *
 * @param {string} filePath
 * @param {{ email: string, password: string }} login
 */
export function writeStoreShotEnv(filePath, login) {
  try {
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
    // Test stand-in for a file appearing after unlink, so flag wx hits EEXIST.
    if (process.env.STORE_SHOT_ENV_INJECT_EEXIST === filePath) {
      writeFileSync(filePath, "kept\n", { encoding: "utf8", flag: "w" });
    }
    writeFileSync(filePath, body, { encoding: "utf8", mode: 0o600, flag: "wx" });
    chmodSync(filePath, 0o600);
  } catch {
    throw new Error("test user seeded, but the env file could not be written");
  }
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
 * Insert or update Alex. Idempotent on `user-alex-play-store` only: fixture
 * XP, streak, and the four board lessons. If the email already belongs to a
 * different id, this throws before any write. Does not write a coach
 * (`progress.data` has no settings), and marks the profile onboarded so the
 * app keeps the default coach.
 *
 * @param {{ execute: Function, batch: Function }} client
 * @param {{ email: string, password: string }} [login]
 * @returns {Promise<string>} user id that was written
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

  const { email, password } = login;
  const found = await client.execute({
    sql: "SELECT id FROM users WHERE email = ?",
    args: [email],
  });
  const existingId = found.rows[0]?.id;
  if (existingId != null && String(existingId) !== TEST_USER_ID) {
    throw new Error(
      "Refusing to seed the test user: that email already belongs to a different account. No rows were written.",
    );
  }

  const now = Date.now();
  const today = isoDay(now);
  const passwordHash = await hashPassword(password);
  const userId = TEST_USER_ID;
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
      args: [userId, email, passwordHash, TEST_USER_NAME, now],
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
  return userId;
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

  let envFile;
  try {
    envFile = resolveStoreShotEnvPath(env);
  } catch (err) {
    console.error(redact(err, env));
    return 1;
  }

  const client = openLocalClient(decision.url, env);
  try {
    if (decision.url.toLowerCase().startsWith("file:")) {
      await client.execute("PRAGMA busy_timeout = 5000");
    }
    const login = storeShotLogin(env);
    const userId = await seedTestUser(client, login);
    writeStoreShotEnv(envFile, login);
    console.log(`test user seeded ${userId}`);
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
