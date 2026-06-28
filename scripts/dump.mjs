/**
 * Regenerate db/seed.sql from the current local.db.
 *
 * Content tables (semesters/classes/lessons) + the ephemeral game_sessions table are
 * DROP+CREATE+INSERT (so re-seeds refresh curriculum and pick up schema changes);
 * auth/user tables use CREATE TABLE IF NOT EXISTS so a remote re-seed preserves accounts.
 */
import Database from "better-sqlite3";
import { writeFileSync, existsSync } from "node:fs";

if (!existsSync("local.db")) {
  console.error("✗ local.db not found. Create it first:\n    pnpm db:fresh\n  (then optionally `pnpm db:import-puzzles <file>`), then re-run `pnpm db:dump`.");
  process.exit(1);
}
const db = new Database("local.db", { readonly: true });
const tables = db
  .prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY rowid")
  .all();
const RESET = new Set(["semesters", "classes", "lessons", "game_sessions"]);
const SEED = ["semesters", "classes", "lessons"];
const esc = (v) =>
  v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`;

let out =
  "-- ChessSchool seed. Refreshes curriculum + session table; PRESERVES user data (auth tables IF NOT EXISTS).\nPRAGMA foreign_keys=OFF;\n";
for (const t of [...tables].reverse()) if (RESET.has(t.name)) out += `DROP TABLE IF EXISTS ${t.name};\n`;
for (const t of tables)
  out += RESET.has(t.name)
    ? t.sql.replace(/\s+/g, " ") + ";\n"
    : t.sql.replace(/\s+/g, " ").replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ") + ";\n";
for (const tbl of SEED) {
  const cols = db.prepare(`PRAGMA table_info(${tbl})`).all().map((c) => c.name);
  for (const r of db.prepare(`SELECT * FROM ${tbl}`).all())
    out += `INSERT INTO ${tbl} (${cols.join(",")}) VALUES (${cols.map((c) => esc(r[c])).join(",")});\n`;
}
writeFileSync("db/seed.sql", out);
const counts = SEED.map((t) => `${db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c} ${t}`).join(" · ");
console.log(`db/seed.sql: ${(out.length / 1024).toFixed(0)} KB · ${counts}`);
