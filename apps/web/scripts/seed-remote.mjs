/**
 * Seed a REMOTE libSQL/Turso DB from db/seed.sql (schema + curriculum content).
 * Run from any network that can reach Turso (e.g. home wifi / hotspot):
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm db:remote
 * Idempotent — safe to re-run (it drops + recreates the content tables).
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("libsql:")) {
  console.error("Set DATABASE_URL=libsql://…  (and DATABASE_AUTH_TOKEN)");
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const raw = readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");
const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--") && !/^PRAGMA/i.test(s));

console.log(`Seeding remote DB — ${stmts.length} statements…`);
for (let i = 0; i < stmts.length; i += 200) {
  await client.batch(stmts.slice(i, i + 200), "write");
  process.stdout.write(`\r  ${Math.min(i + 200, stmts.length)}/${stmts.length}`);
}
const n = (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c;
console.log(`\n✅ Remote DB seeded — ${n} lessons.`);
