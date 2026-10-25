/**
 * Roll curriculum content from db/seed.sql onto a Turso/libSQL database.
 *
 * Default is a dry run: print the hostname and per-table upsert counts, write
 * nothing. Writes require CONFIRM=<hostname>, --apply, and --backup-done.
 * The hostname is the URL host only — never the token, userinfo, path, or query.
 *
 * Refuses when __drizzle_migrations has no row. Does not connect until CONFIRM
 * matches. Never prints DATABASE_URL or DATABASE_AUTH_TOKEN.
 *
 *   CONFIRM=<hostname> pnpm --filter web db:remote
 *   CONFIRM=<hostname> pnpm --filter web db:remote -- --apply --backup-done
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@libsql/client";
import {
  CONTENT_TABLES,
  applyContentUpserts,
  databaseHasMigrationRow,
  databaseHostname,
  invokedDirectly,
  loadContentSeed,
} from "./seed-content.mjs";

const BACKUP_REMINDER = [
  "Take a Turso backup before writing.",
  "Use `turso db shell` to inspect, or create a Turso branch / point-in-time restore.",
].join(" ");

export function parseSeedRemoteArgs(argv) {
  const args = argv.filter((arg) => arg !== "--");
  const known = new Set(["--apply", "--backup-done", "--help", "-h"]);
  return {
    apply: args.includes("--apply"),
    backupDone: args.includes("--backup-done"),
    help: args.includes("--help") || args.includes("-h"),
    unknown: args.filter((arg) => !known.has(arg)),
  };
}

function defaultSeedPath() {
  try {
    const url = new URL("../db/seed.sql", import.meta.url);
    if (url.protocol === "file:") return fileURLToPath(url);
  } catch {
    // Vitest may rewrite import.meta.url. Package scripts run with cwd = apps/web.
  }
  return join(process.cwd(), "db/seed.sql");
}

function defaultOpenClient(url, authToken) {
  if (url.startsWith("file:")) return createClient({ url });
  return createClient({ url, authToken });
}

export function redactSecrets(message, secrets) {
  let text = String(message);
  const hidden = [...secrets].filter((secret) => secret && secret.length > 0);
  hidden.sort((a, b) => b.length - a.length);
  for (const secret of hidden) text = text.split(secret).join("[redacted]");
  return text
    .replace(/libsql:\/\/\S+/gi, "[redacted]")
    .replace(/https?:\/\/\S+/gi, "[redacted]")
    .replace(/authToken=[^\s&'"]+/gi, "authToken=[redacted]");
}

function printHelp() {
  console.log(`Usage: CONFIRM=<hostname> node scripts/seed-remote.mjs [--apply] [--backup-done]

  CONFIRM        Required. Exactly the hostname of DATABASE_URL (no scheme, port, or token).
  (no flags)     Dry run. Connects only to check __drizzle_migrations. Writes nothing.
  --apply        Upsert content tables. Also requires --backup-done.
  --backup-done  Confirms a Turso backup (shell, branch, or point-in-time restore) exists.

Prints the hostname only. Never prints DATABASE_URL or DATABASE_AUTH_TOKEN.
`);
}

export async function runSeedRemote(options = {}) {
  const parsed = parseSeedRemoteArgs(options.argv ?? []);
  const apply = options.apply ?? parsed.apply;
  const backupDone = options.backupDone ?? parsed.backupDone;
  const help = options.help ?? parsed.help;
  const unknown = options.unknown ?? parsed.unknown;

  if (help) {
    printHelp();
    return 0;
  }
  if (unknown.length > 0) {
    console.error(`Unknown argument: ${unknown.join(" ")}`);
    printHelp();
    return 1;
  }

  const url = Object.prototype.hasOwnProperty.call(options, "url")
    ? options.url
    : process.env.DATABASE_URL;
  const authToken = Object.prototype.hasOwnProperty.call(options, "authToken")
    ? options.authToken
    : process.env.DATABASE_AUTH_TOKEN;
  const confirm = Object.prototype.hasOwnProperty.call(options, "confirm")
    ? options.confirm
    : process.env.CONFIRM;
  const secrets = [url, authToken];

  const fail = (message) => {
    console.error(redactSecrets(message, secrets));
    return 1;
  };

  if (!url) {
    return fail(
      "Set DATABASE_URL to the Turso libsql:// URL. The auth token is not printed.",
    );
  }

  const hostname = databaseHostname(url);
  if (!hostname) {
    return fail("Refusing to seed: DATABASE_URL has no hostname.");
  }
  if (confirm !== hostname) {
    console.error(
      "Refusing to seed: CONFIRM must equal the database hostname exactly.",
    );
    console.error(`Hostname: ${hostname}`);
    console.error(
      "Set CONFIRM to that hostname. The auth token and full URL are not printed.",
    );
    return 1;
  }

  let loaded;
  try {
    const raw =
      options.sql ?? readFileSync(options.seedPath ?? defaultSeedPath(), "utf8");
    loaded = loadContentSeed(raw);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  if (!url.startsWith("file:") && !authToken) {
    return fail("DATABASE_AUTH_TOKEN is required. It is not printed.");
  }

  const openClient = options.openClient ?? defaultOpenClient;
  let client;
  try {
    client = openClient(url, authToken);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }

  try {
    const migrated = await databaseHasMigrationRow(client);
    if (!migrated) {
      console.error(
        `Refusing to seed ${hostname}: no __drizzle_migrations row. Apply migrations (or record the baseline) first.`,
      );
      console.error("No writes were made.");
      return 1;
    }

    if (!apply) {
      console.log(`Dry run against ${hostname}.`);
      console.log("Would upsert:");
      for (const table of CONTENT_TABLES) {
        console.log(`  ${table}: ${loaded.counts[table]}`);
      }
      console.log("No writes were made.");
      console.log(
        `Re-run with --apply --backup-done after a backup. ${BACKUP_REMINDER}`,
      );
      return 0;
    }

    console.log(`About to write content upserts on ${hostname}.`);
    console.log(BACKUP_REMINDER);
    if (!backupDone) {
      console.error("Refusing to write without --backup-done.");
      console.error("No writes were made.");
      return 1;
    }

    await client.execute("PRAGMA foreign_keys = ON");
    await applyContentUpserts(client, loaded.statements, (done, total) => {
      process.stdout.write(`\r  ${done}/${total}`);
    });
    process.stdout.write("\n");
    console.log(`Upserted content on ${hostname}.`);
    for (const table of CONTENT_TABLES) {
      console.log(`  ${table}: ${loaded.counts[table]}`);
    }
    return 0;
  } catch (error) {
    console.error(
      redactSecrets(error instanceof Error ? error.message : String(error), secrets),
    );
    console.error(
      "Stopped. Earlier batches may already be committed. Upserts are idempotent; restore the Turso backup if the content looks partial.",
    );
    return 1;
  } finally {
    await client.close();
  }
}

if (invokedDirectly(import.meta.url)) {
  const code = await runSeedRemote({ argv: process.argv.slice(2) });
  process.exit(code);
}
