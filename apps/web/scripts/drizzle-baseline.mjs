/**
 * Shared facts for the committed 0000 baseline.
 *
 * drizzle-orm's migrator (libsql and better-sqlite3) hashes each migration with
 * sha256 of the raw .sql file and stores that hash plus the journal `when`
 * value in `__drizzle_migrations`. A migration runs only when the latest row's
 * created_at is strictly less than that migration's `when`.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const MIGRATIONS_DIR = fileURLToPath(
  new URL("../db/migrations/", import.meta.url),
);

/**
 * Tables the push-era db/seed.sql created with CREATE TABLE.
 * Still required before stamping a database that predates the migration journal.
 * The current seed.sql is content upserts only and does not declare tables.
 */
export const SEED_TABLES = [
  "analytics_events",
  "classes",
  "game_sessions",
  "homework_lessons",
  "lesson_records",
  "lessons",
  "profiles",
  "progress",
  "semesters",
  "sessions",
  "users",
  "web_vitals",
];

/**
 * DDL drizzle-orm uses for the journal table. Kept in sync with
 * drizzle-orm/libsql/migrator.js (id SERIAL PRIMARY KEY, hash, created_at).
 */
export const JOURNAL_DDL = `CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
			id SERIAL PRIMARY KEY,
			hash text NOT NULL,
			created_at numeric
		)`;

export function baselineMeta() {
  const journal = JSON.parse(
    readFileSync(join(MIGRATIONS_DIR, "meta/_journal.json")).toString(),
  );
  const entry = journal.entries[0];
  if (!entry || !String(entry.tag).startsWith("0000_")) {
    throw new Error(
      `Expected db/migrations meta journal to start with a 0000_ baseline (found ${entry?.tag ?? "nothing"}).`,
    );
  }
  const sqlPath = join(MIGRATIONS_DIR, `${entry.tag}.sql`);
  // Same bytes drizzle-orm readMigrationFiles hashes: utf8 toString() of the file.
  const query = readFileSync(sqlPath).toString();
  const hash = createHash("sha256").update(query).digest("hex");
  return { entry, hash, sqlPath };
}

export function baselineCovers(createdAt, when) {
  return Number(createdAt) >= Number(when);
}

export function resolveDbTarget(env = process.env) {
  const raw = env.DATABASE_URL;
  if (!raw) {
    return {
      kind: "local",
      url: "file:local.db",
      path: "local.db",
      display: "file:local.db",
    };
  }
  if (
    raw.startsWith("libsql:") ||
    raw.startsWith("http:") ||
    raw.startsWith("https:")
  ) {
    return { kind: "remote", url: raw, display: safeRemoteDisplay(raw) };
  }
  const path = raw.startsWith("file:") ? raw.slice("file:".length) : raw;
  const url = raw.startsWith("file:") ? raw : `file:${path}`;
  return { kind: "local", url, path, display: url };
}

/** Host only. Never include userinfo, path, query, or the auth token. */
export function safeRemoteDisplay(raw) {
  try {
    const parsed = new URL(raw);
    const port = parsed.port ? `:${parsed.port}` : "";
    return `${parsed.protocol}//${parsed.hostname}${port}`;
  } catch {
    return "remote database";
  }
}
