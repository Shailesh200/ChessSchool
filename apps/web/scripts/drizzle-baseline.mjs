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

/**
 * Vitest rewrites `import.meta.url` to a non-file URL, so `fileURLToPath` throws
 * there. Package scripts run with cwd = apps/web, where `db/migrations` lives.
 */
function resolveMigrationsDir() {
  try {
    const url = new URL("../db/migrations/", import.meta.url);
    if (url.protocol === "file:") return fileURLToPath(url);
  } catch {
    // Fall through to the package cwd.
  }
  return join(process.cwd(), "db/migrations");
}

export const MIGRATIONS_DIR = resolveMigrationsDir();

/** Tables declared by the CREATE TABLE statements in db/seed.sql. */
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

/**
 * Exact local hosts. Trailing dots are kept, so `localhost.` is not local.
 * Same allowlist as `assertLocalSeedTarget` on PR #54. That helper is not on
 * staging, so the check lives here instead of a second copy of the seed script.
 */
const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1"]);

/**
 * Production Turso host. Trailing dots are stripped only for this comparison.
 * Same name as PR #54 `apps/web/db/production-db-hosts.mjs`, which is not on staging.
 */
const PRODUCTION_DB_HOSTS = ["chessschool-shailesh200.aws-ap-south-1.turso.io"];

function isProductionDbHost(hostname) {
  if (!hostname) return false;
  const normalized = String(hostname).toLowerCase().replace(/\.+$/, "");
  return PRODUCTION_DB_HOSTS.some((host) => host.toLowerCase() === normalized);
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
 * local allowlist cannot use `URL.hostname`.
 */
function authorityOf(url) {
  const scheme = schemeOf(url);
  const afterScheme = url.slice(scheme.length + 1);
  const authority = afterScheme.startsWith("//") ? afterScheme.slice(2) : afterScheme;
  const end = authority.search(/[/?#]/);
  return end === -1 ? authority : authority.slice(0, end);
}

function splitHostPort(auth) {
  if (!auth) return { host: "", port: "" };
  if (auth.startsWith("[")) {
    const bracket = auth.indexOf("]");
    const host = (bracket === -1 ? auth : auth.slice(0, bracket + 1)).toLowerCase();
    const rest = bracket === -1 ? "" : auth.slice(bracket + 1);
    const port =
      rest.startsWith(":") && /^\d+$/.test(rest.slice(1)) ? rest.slice(1) : "";
    return { host, port };
  }
  const colon = auth.lastIndexOf(":");
  if (colon !== -1 && /^\d+$/.test(auth.slice(colon + 1))) {
    return { host: auth.slice(0, colon).toLowerCase(), port: auth.slice(colon + 1) };
  }
  return { host: auth.toLowerCase(), port: "" };
}

function isMemoryUrl(url) {
  const value = url.trim().toLowerCase();
  return value === ":memory:" || value.startsWith("file::memory:");
}

function localFile(url, path) {
  return {
    kind: "local",
    url,
    path,
    display: url,
    host: null,
  };
}

function remoteTarget(url, host, port, scheme) {
  const display = host
    ? `${scheme}://${host}${port ? `:${port}` : ""}`
    : "remote database";
  return {
    kind: "remote",
    url: host ? url : null,
    path: null,
    display,
    host: host || null,
  };
}

/**
 * Classify DATABASE_URL. Local means a file path, `:memory:`, or an exact
 * allowlisted host (`localhost` or `127.0.0.1`, trailing dots kept).
 * `\` and `@` are refused before parsing. A parsed username or password is
 * not local. Trailing dots are stripped only when matching a production host.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function resolveDbTarget(env = process.env) {
  const raw = (env.DATABASE_URL ?? "").trim();
  if (!raw) return localFile("file:local.db", "local.db");

  if (raw.includes("\\") || raw.includes("@")) return remoteTarget(raw, "", "", "");

  if (isMemoryUrl(raw)) return localFile(raw, null);

  const scheme = schemeOf(raw);
  if (!scheme) return localFile(`file:${raw}`, raw);

  const parsed = parsedDbUrl(raw);
  const productionHost = hostnameOf(parsed);
  const parts = splitHostPort(authorityOf(raw));
  if (productionHost && isProductionDbHost(productionHost)) {
    return remoteTarget(raw, parts.host, parts.port, scheme);
  }
  if (parsed && (parsed.username !== "" || parsed.password !== "")) {
    return remoteTarget(raw, "", "", "");
  }
  if (scheme === "file") {
    return localFile(raw, raw.slice("file:".length));
  }
  if (LOCAL_HOSTS.has(parts.host)) return localFile(raw, null);
  return remoteTarget(raw, parts.host, parts.port, scheme);
}
