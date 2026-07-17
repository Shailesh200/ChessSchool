/**
 * Load curriculum content from db/seed.sql into local.db (fast path vs seed.mjs + import).
 *
 *   pnpm db:load-seed
 *
 * Expects schema already applied (`pnpm db:push`). Refreshes content tables only;
 * auth/user tables are untouched when they already exist.
 */
import { readFileSync, existsSync } from "node:fs";
import Database from "better-sqlite3";

const SEED_PATH = new URL("../db/seed.sql", import.meta.url);
const DB_PATH = (process.env.DATABASE_URL ?? "local.db").replace(/^file:/, "");

if (!existsSync(SEED_PATH)) {
  console.error("✗ db/seed.sql not found. Run pnpm db:dump after a full import.");
  process.exit(1);
}
if (!existsSync(DB_PATH)) {
  console.error("✗ local.db not found. Run pnpm db:push first.");
  process.exit(1);
}

const raw = readFileSync(SEED_PATH, "utf8");
const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--") && !/^PRAGMA/i.test(s));

const db = new Database(DB_PATH);
db.pragma("foreign_keys = OFF");
const tx = db.transaction(() => {
  for (const sql of stmts) db.exec(`${sql};`);
});
tx();
db.pragma("foreign_keys = ON");
db.close();

console.log(`✓ Loaded seed.sql into ${DB_PATH} (${stmts.length} statements)`);
