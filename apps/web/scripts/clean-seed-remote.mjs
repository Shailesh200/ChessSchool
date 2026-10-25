/**
 * DESTRUCTIVE remote reset — deletes user rows (accounts, sessions, profiles,
 * progress, lesson records, live games, analytics) and then upserts curriculum
 * content from db/seed.sql.
 *
 * Schema is NOT dropped or recreated. Migrations own the tables. seed.sql only
 * upserts semesters, classes, lessons, and homework_lessons.
 *
 * Refuses PRODUCTION_DB_HOSTS even when confirm matches.
 * Confirm is CONFIRM=WIPE:<hostname> (exact hostname of DATABASE_URL).
 * Prints the hostname only, never the URL or auth token.
 *
 * Use only on a disposable database. For a content refresh that keeps accounts
 * and live games, use `pnpm db:remote` (dry-run unless --apply --backup-done).
 *
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE:<hostname> pnpm db:remote-clean
 */
import { readFileSync } from "node:fs";
import { createClient } from "@libsql/client";
import {
  applyContentUpserts,
  databaseHasMigrationRow,
  invokedDirectly,
  loadContentSeed,
} from "./seed-content.mjs";
import { redactSecrets } from "./seed-remote.mjs";
import { assertCanWipe } from "./wipe-guard.mjs";

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

function pick(options, key, envValue) {
  return Object.prototype.hasOwnProperty.call(options, key) ? options[key] : envValue;
}

function defaultSeedText() {
  return readFileSync(new URL("../db/seed.sql", import.meta.url), "utf8");
}

export async function runRemoteClean(options = {}) {
  const url = pick(options, "url", process.env.DATABASE_URL);
  const authToken = pick(options, "authToken", process.env.DATABASE_AUTH_TOKEN);
  const confirm = pick(options, "confirm", process.env.CONFIRM);
  const secrets = [url, authToken];
  const fail = (lines, code = 1) => {
    for (const line of lines) console.error(redactSecrets(line, secrets));
    return code;
  };

  if (
    !url ||
    (!url.startsWith("libsql:") &&
      !url.startsWith("https:") &&
      !url.startsWith("http:"))
  ) {
    return fail([
      "Set DATABASE_URL to a libsql:// or https:// URL. The auth token is not printed.",
    ]);
  }

  const decision = assertCanWipe(url, confirm);
  if (!decision.ok) return fail(decision.lines);
  if (!authToken) return fail(["DATABASE_AUTH_TOKEN is required. It is not printed."]);

  let loaded;
  try {
    const raw = pick(options, "sql", null) ?? defaultSeedText();
    loaded = loadContentSeed(raw);
  } catch (error) {
    return fail([error instanceof Error ? error.message : String(error)]);
  }

  const openClient =
    options.openClient ??
    ((target, token) => createClient({ url: target, authToken: token }));
  let client;
  try {
    client = openClient(url, authToken);
  } catch (error) {
    return fail([error instanceof Error ? error.message : String(error)]);
  }

  const hostname = decision.hostname;
  try {
    if (!(await databaseHasMigrationRow(client))) {
      console.error(
        `Refusing to wipe ${hostname}: no __drizzle_migrations row. No rows were deleted.`,
      );
      return 1;
    }

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

    console.log(`Upserting content — ${loaded.statements.length} statements.`);
    await applyContentUpserts(client, loaded.statements);
    const lessons = Number(
      (await client.execute("SELECT COUNT(*) AS c FROM lessons")).rows[0].c,
    );
    const users = Number(
      (await client.execute("SELECT COUNT(*) AS c FROM users")).rows[0].c,
    );
    console.log(`Clean DB on ${hostname} — ${users} users, ${lessons} lessons.`);
    return 0;
  } catch (error) {
    console.error(
      redactSecrets(error instanceof Error ? error.message : String(error), secrets),
    );
    return 1;
  } finally {
    client.close();
  }
}

if (invokedDirectly(import.meta.url)) {
  const code = await runRemoteClean();
  process.exit(code);
}
