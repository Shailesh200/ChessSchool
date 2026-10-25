/**
 * Apply committed Drizzle migrations.
 *
 * If the database already has application tables but the 0000 baseline is not
 * in `__drizzle_migrations`, exit before drizzle-kit migrate. Replaying
 * 0000_baseline.sql would CREATE TABLE on top of the push / seed.sql schema.
 * Stamp that database with `pnpm db:baseline` first.
 *
 * A missing local file (or a database with no `users` table) is a fresh
 * database: drizzle-kit migrate creates the tables from 0000.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createClient } from "@libsql/client";
import { baselineCovers, baselineMeta, resolveDbTarget } from "./drizzle-baseline.mjs";

function runDrizzleKit() {
  const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  process.exit(result.status ?? 1);
}

const target = resolveDbTarget();
const meta = baselineMeta();

const freshLocal = target.kind === "local" && !existsSync(target.path);

if (!freshLocal) {
  if (target.kind === "remote" && !process.env.DATABASE_AUTH_TOKEN) {
    console.error("DATABASE_AUTH_TOKEN is required to migrate a remote database.");
    process.exit(1);
  }

  const client = createClient(
    target.kind === "remote"
      ? { url: target.url, authToken: process.env.DATABASE_AUTH_TOKEN }
      : { url: target.url },
  );

  let hasUsers = false;
  let applied = false;
  try {
    const tables = await client.execute(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    );
    const names = new Set(tables.rows.map((row) => String(row.name)));
    hasUsers = names.has("users");
    if (names.has("__drizzle_migrations")) {
      const latest = await client.execute(
        'SELECT created_at FROM "__drizzle_migrations" ORDER BY created_at DESC LIMIT 1',
      );
      const row = latest.rows[0];
      applied = !!row && baselineCovers(row.created_at, meta.entry.when);
    }
  } finally {
    client.close();
  }

  if (hasUsers && !applied) {
    console.error(
      `Database ${target.display} already has tables, and the 0000 baseline is not recorded in __drizzle_migrations.`,
    );
    console.error(
      "drizzle-kit migrate would run 0000_baseline.sql (CREATE TABLE) against those tables.",
    );
    console.error("");
    console.error(
      "Existing database (production Turso, or a local file created by db:push):",
    );
    console.error(
      "  pnpm db:baseline                         # dry-run, does not connect",
    );
    console.error("  pnpm db:baseline -- --apply              # local file only");
    console.error("  pnpm db:baseline -- --apply --allow-remote");
    console.error("");
    console.error("Disposable local file:");
    console.error("  pnpm db:fresh");
    process.exit(1);
  }
}

runDrizzleKit();
