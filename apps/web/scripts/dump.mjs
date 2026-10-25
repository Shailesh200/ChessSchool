/**
 * Regenerate db/seed.sql from the local SQLite file (apps/web/local.db).
 *
 * Emits idempotent upserts for content tables only:
 * semesters, classes, lessons, homework_lessons.
 * Schema comes from Drizzle migrations — the file has no DROP or CREATE TABLE.
 * Lesson and class ids are copied as stored. User tables and game_sessions are
 * not read and not written.
 *
 * Stale content rows that are no longer in local.db are left out of the file
 * and are NOT deleted on apply. lesson_records and progress store lesson and
 * class ids without a foreign key, and semesters/classes cascade-delete lessons.
 *
 * Ignores DATABASE_URL. Never opens a remote database.
 *
 *   pnpm --filter web db:dump
 */
import Database from "better-sqlite3";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_TABLES,
  SEED_HEADER,
  invokedDirectly,
  upsertStatement,
} from "./seed-content.mjs";

function packagePaths() {
  let root = process.cwd();
  try {
    const url = new URL("..", import.meta.url);
    if (url.protocol === "file:") root = fileURLToPath(url);
  } catch {
    // Vitest may rewrite import.meta.url. Package scripts run with cwd = apps/web.
  }
  return {
    localDbPath: join(root, "local.db"),
    seedPath: join(root, "db/seed.sql"),
  };
}

export function renderContentSeed(db) {
  const chunks = [SEED_HEADER];
  const counts = {};
  for (const table of CONTENT_TABLES) {
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((column) => column.name);
    if (columns.length === 0) {
      throw new Error(
        `local.db has no ${table} table. Run pnpm db:migrate or pnpm db:fresh first.`,
      );
    }
    const rows = db.prepare(`SELECT * FROM ${table}`).all();
    counts[table] = rows.length;
    for (const row of rows) chunks.push(`${upsertStatement(table, columns, row)};\n`);
  }
  return { sql: chunks.join(""), counts };
}

function formatCounts(counts) {
  return CONTENT_TABLES.map((table) => `${counts[table]} ${table}`).join(" · ");
}

export function dumpLocalSeed() {
  const { localDbPath, seedPath } = packagePaths();
  if (!existsSync(localDbPath)) {
    console.error(
      "✗ local.db not found. Create it first:\n    pnpm db:fresh\n    pnpm db:import-puzzle-school && pnpm db:import-homework && pnpm db:dump\n  Or load the committed snapshot: pnpm db:provision",
    );
    return 1;
  }
  console.log("Reading local.db (DATABASE_URL is ignored).");
  const db = new Database(localDbPath, { readonly: true });
  try {
    const { sql, counts } = renderContentSeed(db);
    writeFileSync(seedPath, sql);
    console.log(
      `db/seed.sql: ${(Buffer.byteLength(sql) / 1024).toFixed(0)} KB · ${formatCounts(counts)}`,
    );
    console.log(
      "Content upserts only. Stale rows are not deleted (user progress may reference lesson and class ids).",
    );
    return 0;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    return 1;
  } finally {
    db.close();
  }
}

if (invokedDirectly(import.meta.url)) {
  process.exit(dumpLocalSeed());
}
