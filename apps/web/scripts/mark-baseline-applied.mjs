/**
 * Record the committed 0000 baseline in `__drizzle_migrations` without running
 * its SQL. Use this on a database that already has the push / seed.sql tables
 * (production Turso). `db:migrate` would otherwise replay CREATE TABLE.
 *
 * Dry-run by default: prints the journal row and does not connect.
 *   node scripts/mark-baseline-applied.mjs
 *   node scripts/mark-baseline-applied.mjs --apply                 # local file only
 *   node scripts/mark-baseline-applied.mjs --apply --allow-remote  # explicit remote write
 *
 * Remote writes require both flags. This script never executes migration SQL
 * and never prints DATABASE_URL or DATABASE_AUTH_TOKEN.
 */
import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import {
  JOURNAL_DDL,
  SEED_TABLES,
  baselineCovers,
  baselineMeta,
  resolveDbTarget,
} from "./drizzle-baseline.mjs";

const KNOWN = new Set(["--apply", "--allow-remote", "--help", "-h"]);

function printPlan(meta, target) {
  console.log(`Baseline: ${meta.entry.tag}`);
  console.log(`created_at: ${meta.entry.when}`);
  console.log(`hash: ${meta.hash}`);
  console.log(`Target: ${target.display} (${target.kind})`);
  console.log("");
  console.log("Journal SQL only — 0000_baseline.sql is not executed:");
  console.log(JOURNAL_DDL.trim() + ";");
  console.log(
    `INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES ('${meta.hash}', ${meta.entry.when});`,
  );
  console.log("");
  console.log(
    "Stamping does not create or alter tables. The baseline snapshot includes objects that db/seed.sql does not:",
  );
  console.log(
    "  - table oauth_accounts (index oauth_accounts_user_id_idx, FK user_id)",
  );
  console.log("  - users.password_hash nullable (seed.sql: NOT NULL)");
  console.log("  - unique index users_email_unique on users.email");
  console.log(
    "  - indexes classes_semester_id_idx, lessons_class_id_idx, lesson_records_user_id_idx, sessions_user_id_idx, sessions_expires_at_idx",
  );
  console.log(
    "A later migration must add any of those that production is missing. drizzle-kit generate will not emit them again.",
  );
}

function printHelp() {
  console.log(`Usage: node scripts/mark-baseline-applied.mjs [--apply] [--allow-remote]

  (no flags)     Print the journal row. Do not connect.
  --apply        Write the row on a local SQLite file that already has the seed.sql tables.
  --allow-remote Required together with --apply when DATABASE_URL is libsql:// or http(s)://.
`);
}

const argv = process.argv.slice(2).filter((arg) => arg !== "--");
const unknown = argv.filter((arg) => !KNOWN.has(arg));
if (unknown.length > 0) {
  console.error(`Unknown argument: ${unknown.join(" ")}`);
  printHelp();
  process.exit(1);
}
if (argv.includes("--help") || argv.includes("-h")) {
  printHelp();
  process.exit(0);
}

const apply = argv.includes("--apply");
const allowRemote = argv.includes("--allow-remote");
const meta = baselineMeta();
const target = resolveDbTarget();

printPlan(meta, target);

if (!apply) {
  console.log("");
  console.log("Dry-run. No database connection was opened.");
  if (target.kind === "remote") {
    console.log(
      "To write the journal row on this remote database, re-run with --apply --allow-remote.",
    );
  } else {
    console.log("To write the journal row on the local file, re-run with --apply.");
  }
  process.exit(0);
}

if (target.kind === "remote" && !allowRemote) {
  console.error("");
  console.error("Refusing to write to a remote database without --allow-remote.");
  console.error("No connection was opened.");
  process.exit(1);
}

if (target.kind === "remote" && !process.env.DATABASE_AUTH_TOKEN) {
  console.error("DATABASE_AUTH_TOKEN is required to connect to a remote database.");
  process.exit(1);
}

if (target.kind === "local" && !existsSync(target.path)) {
  console.error(
    `No local database at ${target.display}. Refusing to stamp a missing file. Use pnpm db:migrate or pnpm db:fresh so 0000 creates the tables.`,
  );
  process.exit(1);
}

const client = createClient(
  target.kind === "remote"
    ? { url: target.url, authToken: process.env.DATABASE_AUTH_TOKEN }
    : { url: target.url },
);

try {
  const tx = await client.transaction("write");
  try {
    const tables = await tx.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = new Set(tables.rows.map((row) => String(row.name)));
    const missing = SEED_TABLES.filter((name) => !names.has(name));
    if (missing.length > 0) {
      throw new Error(
        `Refusing to stamp: missing tables (${missing.join(", ")}). An empty or partial database should run pnpm db:migrate so 0000 creates them.`,
      );
    }

    await tx.execute(JOURNAL_DDL);
    const existing = await tx.execute(
      'SELECT hash, created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
    );
    const latest = existing.rows[0];
    if (latest && baselineCovers(latest.created_at, meta.entry.when)) {
      await tx.commit();
      console.log("");
      console.log(
        `Baseline already recorded (latest created_at=${latest.created_at}). No migration SQL was run.`,
      );
    } else {
      await tx.execute({
        sql: 'INSERT INTO "__drizzle_migrations" ("hash", "created_at") VALUES (?, ?)',
        args: [meta.hash, meta.entry.when],
      });
      await tx.commit();
      console.log("");
      console.log(
        `Recorded ${meta.entry.tag} in __drizzle_migrations. No migration SQL was run.`,
      );
    }
  } catch (error) {
    await tx.rollback();
    throw error;
  } finally {
    tx.close();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
} finally {
  client.close();
}
