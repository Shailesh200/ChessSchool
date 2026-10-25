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
 * Refuses to write when any content table would have fewer rows than the
 * current db/seed.sql, unless `--allow-shrink` is passed.
 *
 *   pnpm --filter web db:dump
 *   pnpm --filter web db:dump -- --allow-shrink
 */
import Database from "better-sqlite3";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONTENT_TABLES,
  SEED_HEADER,
  invokedDirectly,
  loadContentSeed,
  upsertStatement,
} from "./seed-content.mjs";

export function parseDumpArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const known = new Set(["--allow-shrink", "--help", "-h"]);
  return {
    allowShrink: args.includes("--allow-shrink"),
    help: args.includes("--help") || args.includes("-h"),
    unknown: args.filter((arg) => !known.has(arg)),
  };
}

/** Tables whose next snapshot has fewer rows than the current seed file. */
export function contentShrinks(previous, next) {
  const shrunk = [];
  for (const table of CONTENT_TABLES) {
    const from = previous?.[table] ?? 0;
    const to = next?.[table] ?? 0;
    if (to < from) shrunk.push({ table, from, to });
  }
  return shrunk;
}

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

export function dumpLocalSeed(options = {}) {
  const parsed = parseDumpArgs(options.argv ?? []);
  if (options.argv && parsed.unknown.length > 0) {
    console.error(`Unknown argument: ${parsed.unknown.join(" ")}`);
    console.error("Usage: node scripts/dump.mjs [--allow-shrink]");
    return 1;
  }
  if (parsed.help) {
    console.log("Usage: node scripts/dump.mjs [--allow-shrink]");
    console.log(
      "Refuses when a content table would shrink unless --allow-shrink is set.",
    );
    console.log("Reads local.db only. DATABASE_URL is ignored.");
    return 0;
  }
  const allowShrink = options.allowShrink === true || parsed.allowShrink;
  const defaults = packagePaths();
  const localDbPath = options.localDbPath ?? defaults.localDbPath;
  const seedPath = options.seedPath ?? defaults.seedPath;
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
    if (existsSync(seedPath)) {
      let previous;
      try {
        previous = loadContentSeed(readFileSync(seedPath, "utf8")).counts;
      } catch (error) {
        console.error(
          "Refusing to overwrite db/seed.sql: the current snapshot could not be counted.",
        );
        console.error(error instanceof Error ? error.message : String(error));
        return 1;
      }
      const shrunk = contentShrinks(previous, counts);
      if (shrunk.length > 0 && !allowShrink) {
        console.error("Refusing to shrink db/seed.sql.");
        for (const row of shrunk) {
          console.error(`  ${row.table}: ${row.from} → ${row.to}`);
        }
        console.error("Pass --allow-shrink to write a smaller snapshot.");
        console.error("No file was written.");
        return 1;
      }
    }
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
  process.exit(dumpLocalSeed({ argv: process.argv.slice(2) }));
}
