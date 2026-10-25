/**
 * Content snapshot shared by db:dump, db:remote, and db:load-seed.
 *
 * Only semesters, classes, lessons, and homework_lessons are written.
 * Schema comes from Drizzle migrations. User tables and game_sessions are never
 * mentioned. Statements are single-line upserts so a seed file cannot carry DDL.
 */
import { pathToFileURL } from "node:url";

export const CONTENT_TABLES = ["semesters", "classes", "lessons", "homework_lessons"];

const CONTENT_LIST = CONTENT_TABLES.join("|");
const UPSERT_TABLE = new RegExp(
  `^INSERT INTO (${CONTENT_LIST}) \\([a-z0-9_,]+\\) VALUES \\(`,
);
const CONFLICT_MARKER = " ON CONFLICT(id) DO UPDATE SET ";
const CONFLICT_TAIL =
  /^([a-z0-9_]+=excluded\.[a-z0-9_]+)(,[a-z0-9_]+=excluded\.[a-z0-9_]+)*$/;
const IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

export const SEED_HEADER = `-- ChessSchool content seed. Idempotent upserts only.
-- Schema comes from Drizzle migrations. No DROP, CREATE TABLE, or DELETE.
-- Tables: semesters, classes, lessons, homework_lessons.
-- Does not modify users, sessions, oauth_accounts, profiles, progress,
-- lesson_records, game_sessions, analytics_events, or web_vitals.
-- Stale content rows that are no longer in this file are left in place.
-- lesson_records.lesson_id and progress JSON store those ids without a foreign
-- key, and classes/lessons use ON DELETE CASCADE, so deleting a removed
-- semester or class would destroy lessons user progress still names.
`;

export function invokedDirectly(metaUrl) {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return metaUrl === pathToFileURL(entry).href;
  } catch {
    return false;
  }
}

/** Hostname only. Never userinfo, path, query, port, or the auth token. */
export function databaseHostname(raw) {
  if (!raw || typeof raw !== "string") return null;
  try {
    const hostname = new URL(raw).hostname;
    return hostname || null;
  } catch {
    return null;
  }
}

export function sqlLiteral(value) {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new Error("Refusing a non-finite number in seed SQL.");
    }
    return String(value);
  }
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "string") return `'${value.replaceAll("'", "''")}'`;
  throw new Error("Refusing a non-scalar value in seed SQL.");
}

export function upsertStatement(table, columns, row) {
  if (!CONTENT_TABLES.includes(table)) {
    throw new Error(`Refusing to emit SQL for non-content table ${table}.`);
  }
  if (!columns.includes("id")) {
    throw new Error(`Content table ${table} has no id column.`);
  }
  const updates = [];
  const values = columns.map((column) => {
    if (!IDENTIFIER.test(column)) {
      throw new Error(`Refusing unexpected column ${column} on ${table}.`);
    }
    if (!Object.prototype.hasOwnProperty.call(row, column)) {
      throw new Error(`Row in ${table} is missing ${column}.`);
    }
    if (column !== "id") updates.push(`${column}=excluded.${column}`);
    return sqlLiteral(row[column]);
  });
  if (updates.length === 0) {
    throw new Error(`Content table ${table} has no columns to update.`);
  }
  return (
    `INSERT INTO ${table} (${columns.join(",")}) VALUES (${values.join(",")})` +
    `${CONFLICT_MARKER}${updates.join(",")}`
  );
}

/** Drop comments and blank lines. One statement per remaining line. */
export function splitSeedStatements(raw) {
  const statements = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("--")) continue;
    const sql = trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
    if (sql) statements.push(sql);
  }
  return statements;
}

export function assertContentUpsert(sql) {
  if (sql.includes("\n") || !UPSERT_TABLE.test(sql)) {
    throw new Error("Refusing a seed statement that is not a content-table upsert.");
  }
  const at = sql.lastIndexOf(CONFLICT_MARKER);
  if (at < 0 || at < sql.indexOf(") VALUES (")) {
    throw new Error("Refusing a seed statement that is not a content-table upsert.");
  }
  const tail = sql.slice(at + CONFLICT_MARKER.length);
  if (!CONFLICT_TAIL.test(tail)) {
    throw new Error("Refusing a seed statement with an unexpected ON CONFLICT clause.");
  }
}

export function countUpserts(statements) {
  const counts = Object.fromEntries(CONTENT_TABLES.map((table) => [table, 0]));
  for (const sql of statements) {
    assertContentUpsert(sql);
    const table = sql.slice("INSERT INTO ".length).split(" ", 1)[0];
    counts[table] += 1;
  }
  return counts;
}

export function loadContentSeed(raw) {
  const statements = splitSeedStatements(raw);
  return { statements, counts: countUpserts(statements) };
}

export async function applyContentUpserts(client, statements, onProgress) {
  const size = 200;
  for (let i = 0; i < statements.length; i += size) {
    const chunk = statements.slice(i, i + size);
    for (const sql of chunk) assertContentUpsert(sql);
    await client.batch(chunk, "write");
    if (onProgress)
      onProgress(Math.min(i + size, statements.length), statements.length);
  }
}

export async function databaseHasMigrationRow(client) {
  const tables = await client.execute(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
  );
  if (tables.rows.length === 0) return false;
  const result = await client.execute(
    'SELECT COUNT(*) AS c FROM "__drizzle_migrations"',
  );
  return Number(result.rows[0]?.c ?? 0) > 0;
}
