/**
 * Seed a REMOTE libSQL/Turso DB from db/seed.sql.gz (schema + curriculum content).
 * The gzip is decompressed in memory. Run from any network that can reach Turso
 * (e.g. home wifi / hotspot):
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm db:remote
 * Idempotent — safe to re-run (it drops + recreates the content tables).
 */
import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import {
  SEED_SQL_GZ_PATH,
  readSeedSql,
  splitSeedStatements,
} from "../db/seed-file.mjs";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("libsql:")) {
  console.error("Set DATABASE_URL=libsql://…  (and DATABASE_AUTH_TOKEN)");
  process.exit(1);
}
if (!existsSync(SEED_SQL_GZ_PATH)) {
  console.error("✗ db/seed.sql.gz not found. Run pnpm db:dump after a full import.");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const stmts = splitSeedStatements(readSeedSql());

console.log(`Seeding remote DB — ${stmts.length} statements…`);
for (let i = 0; i < stmts.length; i += 200) {
  await client.batch(stmts.slice(i, i + 200), "write");
  process.stdout.write(`\r  ${Math.min(i + 200, stmts.length)}/${stmts.length}`);
}
const n = (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c;
console.log(`\n✅ Remote DB seeded — ${n} lessons.`);
