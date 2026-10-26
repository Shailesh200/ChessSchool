/**
 * Regenerate db/seed.sql.gz from apps/web/local.db.
 *
 * The path is resolved from this package, not process.cwd(). DATABASE_URL is
 * ignored — this never opens a remote database.
 *
 * Content tables (semesters/classes/lessons) + the ephemeral game_sessions table are
 * DROP+CREATE+INSERT (so re-seeds refresh curriculum and pick up schema changes);
 * auth/user tables use CREATE TABLE IF NOT EXISTS so a remote re-seed preserves accounts.
 *
 * Output is deterministic gzip (level 9, mtime 0, no filename). A plain
 * db/seed.sql left beside it is removed so it cannot be committed by mistake.
 */
import Database from "better-sqlite3";
import { existsSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  LOCAL_DB_PATH,
  SEED_SQL_GZ_PATH,
  formatSeedBytes,
  writeSeedSql,
} from "../db/seed-file.mjs";

if (!existsSync(LOCAL_DB_PATH)) {
  console.error(
    `✗ local.db not found at ${LOCAL_DB_PATH}. Create it first:\n    pnpm db:fresh\n    pnpm db:import-puzzle-school && pnpm db:import-homework && pnpm db:dump\n  Or load committed seed: pnpm db:provision`,
  );
  process.exit(1);
}
const db = new Database(LOCAL_DB_PATH, { readonly: true });
const tables = db
  .prepare(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND sql IS NOT NULL ORDER BY rowid",
  )
  .all();
const RESET = new Set([
  "semesters",
  "classes",
  "lessons",
  "homework_lessons",
  "game_sessions",
]);
const SEED = ["semesters", "classes", "lessons", "homework_lessons"];
const esc = (v) =>
  v === null
    ? "NULL"
    : typeof v === "number"
      ? String(v)
      : `'${String(v).replace(/'/g, "''")}'`;

let out =
  "-- ChessSchool seed. Refreshes curriculum + session table; PRESERVES user data (auth tables IF NOT EXISTS).\nPRAGMA foreign_keys=OFF;\n";
for (const t of [...tables].reverse())
  if (RESET.has(t.name)) out += `DROP TABLE IF EXISTS ${t.name};\n`;
for (const t of tables)
  out += RESET.has(t.name)
    ? t.sql.replace(/\s+/g, " ") + ";\n"
    : t.sql
        .replace(/\s+/g, " ")
        .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ") + ";\n";
for (const tbl of SEED) {
  const cols = db
    .prepare(`PRAGMA table_info(${tbl})`)
    .all()
    .map((c) => c.name);
  for (const r of db.prepare(`SELECT * FROM ${tbl}`).all())
    out += `INSERT INTO ${tbl} (${cols.join(",")}) VALUES (${cols.map((c) => esc(r[c])).join(",")});\n`;
}
const gz = writeSeedSql(out);
const plain = join(dirname(SEED_SQL_GZ_PATH), "seed.sql");
if (existsSync(plain)) unlinkSync(plain);
const counts = SEED.map(
  (t) => `${db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c} ${t}`,
).join(" · ");
console.log(
  `db/seed.sql.gz: ${formatSeedBytes(gz.length)} gzip · ${(Buffer.byteLength(out) / 1024).toFixed(0)} KB sql · ${counts}`,
);
