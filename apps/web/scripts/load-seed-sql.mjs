/**
 * Load curriculum content from db/seed.sql into the local SQLite file.
 *
 *   pnpm db:load-seed
 *
 * Expects schema from `pnpm db:migrate`. Applies content upserts only
 * (semesters, classes, lessons, homework_lessons). User tables and
 * game_sessions are not modified. Stale content rows are left in place.
 */
import { readFileSync, existsSync } from "node:fs";
import Database from "better-sqlite3";
import { loadContentSeed } from "./seed-content.mjs";

const SEED_PATH = new URL("../db/seed.sql", import.meta.url);
const DB_PATH = (process.env.DATABASE_URL ?? "local.db").replace(/^file:/, "");

if (!existsSync(SEED_PATH)) {
  console.error("✗ db/seed.sql not found. Run pnpm db:dump after a full import.");
  process.exit(1);
}
if (
  DB_PATH.startsWith("libsql:") ||
  DB_PATH.startsWith("http:") ||
  DB_PATH.startsWith("https:")
) {
  console.error(
    "✗ db:load-seed only writes a local SQLite file. Remote content goes through db:remote.",
  );
  process.exit(1);
}
if (!existsSync(DB_PATH)) {
  console.error("✗ local.db not found. Run pnpm db:migrate first.");
  process.exit(1);
}

const raw = readFileSync(SEED_PATH, "utf8");
let loaded;
try {
  loaded = loadContentSeed(raw);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");
const tx = db.transaction(() => {
  for (const sql of loaded.statements) db.exec(sql);
});
let failed = false;
try {
  tx();
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  failed = true;
} finally {
  db.close();
}
if (failed) process.exit(1);

const counts = loaded.statements.length;
console.log(`✓ Loaded seed.sql into ${DB_PATH} (${counts} content upserts)`);
