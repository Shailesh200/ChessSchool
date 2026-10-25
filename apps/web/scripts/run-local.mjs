/**
 * Run web package scripts against the local SQLite file.
 *
 * db:fresh and db:provision delete and rebuild local.db. They ignore
 * DATABASE_URL / DATABASE_AUTH_TOKEN so a shell pointed at Turso cannot
 * migrate or reseed production. Remote schema changes go through
 * `pnpm db:migrate` and `pnpm db:baseline` only.
 */
import { spawnSync } from "node:child_process";

const scripts = process.argv.slice(2);
if (scripts.length === 0) {
  console.error("Usage: node scripts/run-local.mjs <package-script>...");
  process.exit(1);
}

const env = { ...process.env };
delete env.DATABASE_URL;
delete env.DATABASE_AUTH_TOKEN;

console.log("Using local SQLite file (local.db). DATABASE_URL is ignored.");

for (const script of scripts) {
  const result = spawnSync("pnpm", ["run", script], {
    stdio: "inherit",
    env,
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}
