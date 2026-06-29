/**
 * ⚠️ DESTRUCTIVE remote seed — wipes ALL user data (accounts, sessions, profiles,
 * progress, lesson records, live games) AND reseeds curriculum content.
 *
 * Use ONLY for testing a fresh flow — never on a real production DB with users you
 * care about. Guarded behind CONFIRM=WIPE so it can't run by accident:
 *
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE pnpm db:remote-clean
 *
 * For normal, non-destructive content refreshes use `pnpm db:remote` instead.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";

const url = process.env.DATABASE_URL;
if (!url || !url.startsWith("libsql:")) {
  console.error("Set DATABASE_URL=libsql://…  (and DATABASE_AUTH_TOKEN)");
  process.exit(1);
}
if (process.env.CONFIRM !== "WIPE") {
  console.error(
    "⚠️  This DELETES ALL USERS/ACCOUNTS/PROGRESS on the remote DB.\n" +
      "    If you're sure, re-run with CONFIRM=WIPE:\n" +
      "    DATABASE_URL=… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE pnpm db:remote-clean",
  );
  process.exit(1);
}

const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });

// Drop child tables before parents (FKs reference users). seed.sql recreates them
// empty via CREATE TABLE IF NOT EXISTS, then loads curriculum content.
const USER_TABLES = ["lesson_records", "progress", "profiles", "sessions", "game_sessions", "users"];
console.log("⚠️  Wiping all user data…");
await client.execute("PRAGMA foreign_keys=OFF");
for (const t of USER_TABLES) await client.execute(`DROP TABLE IF EXISTS ${t}`);

const raw = readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");
const stmts = raw
  .split(/;\s*\n/)
  .map((s) => s.trim())
  .filter((s) => s && !s.startsWith("--") && !/^PRAGMA/i.test(s));

console.log(`Reseeding — ${stmts.length} statements…`);
for (let i = 0; i < stmts.length; i += 200) {
  await client.batch(stmts.slice(i, i + 200), "write");
  process.stdout.write(`\r  ${Math.min(i + 200, stmts.length)}/${stmts.length}`);
}
const lessons = (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c;
const users = (await client.execute("SELECT COUNT(*) AS c FROM users")).rows[0].c;
console.log(`\n✅ Clean DB — ${users} users (all cleared), ${lessons} lessons seeded.`);
