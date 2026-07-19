/**
 * Wipe user accounts, progress, live games, analytics, and vitals.
 * PRESERVES curriculum: semesters, classes, lessons, homework_lessons.
 *
 * Local:
 *   CONFIRM=WIPE pnpm --filter web db:wipe-users
 *
 * Remote Turso:
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE pnpm --filter web db:wipe-users
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";

if (process.env.CONFIRM !== "WIPE") {
  console.error(
    "⚠️  This DELETES all users, progress, games, analytics, and vitals.\n" +
      "    Curriculum (lessons / puzzles / homework content) is kept.\n" +
      "    Re-run with CONFIRM=WIPE to proceed.",
  );
  process.exit(1);
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

const client = url?.startsWith("libsql:")
  ? createClient({ url, authToken })
  : createClient({
      url: `file:${path.join(__dirname, "..", "local.db")}`,
    });

const target = url?.startsWith("libsql:") ? url.replace(/^libsql:\/\//, "") : "local.db";

/** Child → parent order. Curriculum tables are intentionally omitted. */
const TABLES = [
  "analytics_events",
  "web_vitals",
  "lesson_records",
  "progress",
  "profiles",
  "sessions",
  "oauth_accounts",
  "game_sessions",
  "users",
];

async function count(table) {
  try {
    const r = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
    return Number(r.rows[0]?.c ?? 0);
  } catch {
    return -1; // missing table
  }
}

console.log(`⚠️  Wiping user + analytics data on ${target}`);
console.log("   Keeping: semesters, classes, lessons, homework_lessons\n");

const before = {};
for (const t of TABLES) before[t] = await count(t);
before.lessons = await count("lessons");
before.homework_lessons = await count("homework_lessons");

await client.execute("PRAGMA foreign_keys=OFF");
for (const t of TABLES) {
  if (before[t] < 0) {
    console.log(`  skip ${t} (missing)`);
    continue;
  }
  await client.execute(`DELETE FROM ${t}`);
  console.log(`  cleared ${t} (${before[t]} rows)`);
}
await client.execute("PRAGMA foreign_keys=ON");

const afterLessons = await count("lessons");
const afterHw = await count("homework_lessons");
const afterUsers = await count("users");
const afterEvents = await count("analytics_events");

console.log("\n✅ Wipe complete");
console.log(`   users: ${afterUsers}  analytics_events: ${afterEvents}`);
console.log(`   lessons: ${afterLessons} (was ${before.lessons})`);
console.log(`   homework_lessons: ${afterHw} (was ${before.homework_lessons})`);

if (afterLessons === 0) {
  console.error("\n✗ lessons table is empty — curriculum may be missing. Re-seed with db:remote.");
  process.exit(2);
}
