/**
 * Load curriculum content from db/seed.sql.gz into the local SQLite file
 * (fast path vs seed.mjs + import). The gzip is decompressed in memory.
 *
 *   pnpm db:load-seed
 *
 * Expects schema already applied (`pnpm db:push`). Refreshes content tables only;
 * auth/user tables are untouched when they already exist.
 *
 * Default database is apps/web/local.db (next to this package, not the cwd).
 * A file: DATABASE_URL is honored. A remote URL is refused and never opened.
 */
import { existsSync } from "node:fs";
import Database from "better-sqlite3";
import {
  LOCAL_DB_PATH,
  SEED_SQL_GZ_PATH,
  applySeedStatements,
  readSeedSql,
} from "../db/seed-file.mjs";

function resolveDbPath() {
  const raw = process.env.DATABASE_URL;
  if (!raw) return LOCAL_DB_PATH;
  if (
    raw.startsWith("libsql:") ||
    raw.startsWith("http:") ||
    raw.startsWith("https:")
  ) {
    console.error(
      "✗ db:load-seed only opens a local SQLite file. A remote DATABASE_URL was not used.",
    );
    process.exit(1);
  }
  return raw.replace(/^file:/, "");
}

const dbPath = resolveDbPath();

if (!existsSync(SEED_SQL_GZ_PATH)) {
  console.error("✗ db/seed.sql.gz not found. Run pnpm db:dump after a full import.");
  process.exit(1);
}
if (!existsSync(dbPath)) {
  console.error(`✗ local.db not found at ${dbPath}. Run pnpm db:push first.`);
  process.exit(1);
}

const db = new Database(dbPath);
try {
  const statements = applySeedStatements(db, readSeedSql());
  console.log(`✓ Loaded seed.sql.gz into ${dbPath} (${statements} statements)`);
} finally {
  db.close();
}
