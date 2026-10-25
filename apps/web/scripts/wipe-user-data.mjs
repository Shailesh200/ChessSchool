/**
 * Wipe user accounts, progress, live games, analytics, and vitals.
 * PRESERVES curriculum: semesters, classes, lessons, homework_lessons.
 *
 * Refuses PRODUCTION_DB_HOSTS even when confirm matches.
 * Confirm is CONFIRM=WIPE:<hostname> (exact hostname of DATABASE_URL).
 * The local file uses hostname `local.db`. The command prints the hostname
 * only, never the URL or auth token.
 *
 *   CONFIRM=WIPE:local.db pnpm --filter web db:wipe-users
 *   DATABASE_URL=libsql://… DATABASE_AUTH_TOKEN=… CONFIRM=WIPE:<hostname> pnpm --filter web db:wipe-users
 */
import { createClient } from "@libsql/client";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { redactSecrets } from "./seed-remote.mjs";
import { invokedDirectly } from "./seed-content.mjs";
import { assertCanWipe } from "./wipe-guard.mjs";

function packageRoot() {
  try {
    const url = new URL("..", import.meta.url);
    if (url.protocol === "file:") return fileURLToPath(url);
  } catch {
    // Vitest may rewrite import.meta.url. Package scripts run with cwd = apps/web.
  }
  return process.cwd();
}

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

function pick(options, key, envValue) {
  return Object.prototype.hasOwnProperty.call(options, key) ? options[key] : envValue;
}

function defaultOpen(url, authToken) {
  if (
    url &&
    (url.startsWith("libsql:") || url.startsWith("https:") || url.startsWith("http:"))
  ) {
    return createClient({ url, authToken });
  }
  if (url && url.startsWith("file:")) return createClient({ url });
  return createClient({ url: `file:${path.join(packageRoot(), "local.db")}` });
}

export async function runWipeUsers(options = {}) {
  const url = pick(options, "url", process.env.DATABASE_URL);
  const authToken = pick(options, "authToken", process.env.DATABASE_AUTH_TOKEN);
  const confirm = pick(options, "confirm", process.env.CONFIRM);
  const secrets = [url, authToken];
  const fail = (lines) => {
    for (const line of lines) console.error(redactSecrets(line, secrets));
    return 1;
  };

  const decision = assertCanWipe(url, confirm);
  if (!decision.ok) return fail(decision.lines);

  if (decision.hosted && !authToken) {
    return fail(["DATABASE_AUTH_TOKEN is required. It is not printed."]);
  }

  const openClient = options.openClient ?? defaultOpen;
  let client;
  try {
    client = openClient(url, authToken);
  } catch (error) {
    return fail([error instanceof Error ? error.message : String(error)]);
  }

  const hostname = decision.hostname;
  try {
    async function count(table) {
      try {
        const result = await client.execute(`SELECT COUNT(*) AS c FROM ${table}`);
        return Number(result.rows[0]?.c ?? 0);
      } catch {
        return -1;
      }
    }

    console.log(`Wiping user and analytics rows on ${hostname}.`);
    console.log("Keeping: semesters, classes, lessons, homework_lessons.");

    const before = {};
    for (const table of TABLES) before[table] = await count(table);
    before.lessons = await count("lessons");
    before.homework_lessons = await count("homework_lessons");

    await client.execute("PRAGMA foreign_keys = OFF");
    for (const table of TABLES) {
      if (before[table] < 0) {
        console.log(`  skip ${table} (missing)`);
        continue;
      }
      await client.execute(`DELETE FROM ${table}`);
      console.log(`  cleared ${table} (${before[table]} rows)`);
    }
    await client.execute("PRAGMA foreign_keys = ON");

    const afterLessons = await count("lessons");
    const afterHw = await count("homework_lessons");
    const afterUsers = await count("users");
    const afterEvents = await count("analytics_events");

    console.log(`Wipe complete on ${hostname}.`);
    console.log(`  users: ${afterUsers}  analytics_events: ${afterEvents}`);
    console.log(`  lessons: ${afterLessons} (was ${before.lessons})`);
    console.log(`  homework_lessons: ${afterHw} (was ${before.homework_lessons})`);

    if (afterLessons === 0) {
      console.error(
        "lessons table is empty — curriculum may be missing. Roll out content with db:remote (docs/ENV.md).",
      );
      return 2;
    }
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
  const code = await runWipeUsers();
  process.exit(code);
}
