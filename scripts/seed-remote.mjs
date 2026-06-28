/**
 * Seed a REMOTE libSQL/Turso DB from db/seed.sql (schema + curriculum content).
 * Run from a network that can reach Turso:
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… pnpm db:remote
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("libsql:")) { console.error("Set DATABASE_URL=libsql://…"); process.exit(1); }
const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
const sql = readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");
console.log("Seeding remote DB…");
await client.executeMultiple(sql);
const n = (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c;
console.log(`✅ Remote DB seeded — ${n} lessons.`);
