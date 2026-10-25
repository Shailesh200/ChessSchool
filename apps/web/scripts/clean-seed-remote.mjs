/**
 * DESTRUCTIVE remote reset — deletes user rows (accounts, sessions, profiles,
 * progress, lesson records, live games, analytics) and then upserts curriculum
 * content from db/seed.sql.
 *
 * Schema is NOT dropped or recreated. Migrations own the tables. seed.sql only
 * upserts semesters, classes, lessons, and homework_lessons.
 *
 * Use only on a disposable database. For a content refresh that keeps accounts
 * and live games, use `pnpm db:remote` (dry-run unless --apply --backup-done).
 *
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE pnpm db:remote-clean
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import {
  applyContentUpserts,
  databaseHasMigrationRow,
  databaseHostname,
  loadContentSeed,
} from "./seed-content.mjs";
import { redactSecrets } from "./seed-remote.mjs";

const url = process.env.DATABASE_URL;
const authToken = process.env.DATABASE_AUTH_TOKEN;

if (
  !url ||
  (!url.startsWith("libsql:") && !url.startsWith("https:") && !url.startsWith("http:"))
) {
  console.error(
    "Set DATABASE_URL=libsql://…  (and DATABASE_AUTH_TOKEN). The token is not printed.",
  );
  process.exit(1);
}
if (process.env.CONFIRM !== "WIPE") {
  console.error(
    "This DELETES all users, accounts, progress, and live games on the remote DB.\n" +
      "Curriculum tables are upserted, not dropped.\n" +
      "If you're sure, re-run with CONFIRM=WIPE:\n" +
      "    DATABASE_URL=… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE pnpm db:remote-clean",
  );
  process.exit(1);
}

const hostname = databaseHostname(url);
if (!hostname) {
  console.error("Refusing to wipe: DATABASE_URL has no hostname.");
  process.exit(1);
}
if (!authToken) {
  console.error("DATABASE_AUTH_TOKEN is required. It is not printed.");
  process.exit(1);
}

let loaded;
try {
  loaded = loadContentSeed(
    readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8"),
  );
} catch (error) {
  console.error(
    redactSecrets(error instanceof Error ? error.message : String(error), [
      url,
      authToken,
    ]),
  );
  process.exit(1);
}

const USER_TABLES = [
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

const client = createClient({ url, authToken });
let exitCode = 0;
try {
  if (!(await databaseHasMigrationRow(client))) {
    console.error(
      `Refusing to wipe ${hostname}: no __drizzle_migrations row. No rows were deleted.`,
    );
    exitCode = 1;
  } else {
    const present = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = new Set(present.rows.map((row) => String(row.name)));

    console.log(`Wiping user rows on ${hostname}. Curriculum tables are not dropped.`);
    await client.execute("PRAGMA foreign_keys = OFF");
    for (const table of USER_TABLES) {
      if (!names.has(table)) {
        console.log(`  skip ${table} (missing)`);
        continue;
      }
      await client.execute(`DELETE FROM ${table}`);
      console.log(`  cleared ${table}`);
    }
    await client.execute("PRAGMA foreign_keys = ON");

    console.log(`Upserting content — ${loaded.statements.length} statements…`);
    await applyContentUpserts(client, loaded.statements, (done, total) => {
      process.stdout.write(`\r  ${done}/${total}`);
    });
    process.stdout.write("\n");
    const lessons = Number(
      (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c,
    );
    const users = Number(
      (await client.execute("SELECT COUNT(*) AS c FROM users")).rows[0].c,
    );
    console.log(`Clean DB on ${hostname} — ${users} users, ${lessons} lessons.`);
  }
} catch (error) {
  console.error(
    redactSecrets(error instanceof Error ? error.message : String(error), [
      url,
      authToken,
    ]),
  );
  exitCode = 1;
} finally {
  client.close();
}
process.exit(exitCode);
