/**
 * Apply committed Drizzle migrations.
 *
 * If the database already has application tables but the 0000 baseline is not
 * in `__drizzle_migrations`, exit before drizzle-kit migrate. Replaying
 * 0000_baseline.sql would CREATE TABLE on top of an existing schema.
 * Stamp that database with `pnpm db:baseline` first.
 *
 * A non-local database is not contacted unless the host is confirmed: type the
 * host at the prompt, or pass `--yes-remote=<host>` with that exact host.
 * With no confirmation the process exits 1 before any connection.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { pathToFileURL } from "node:url";
import { createClient } from "@libsql/client";
import { baselineCovers, baselineMeta, resolveDbTarget } from "./drizzle-baseline.mjs";

const REFUSAL =
  "Refusing to migrate a non-local database without an exact host confirmation. No connection was opened.";

function invokedDirectly() {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return import.meta.url === pathToFileURL(path.resolve(entry)).href;
  } catch {
    return false;
  }
}

/**
 * `--yes-remote=<host>` from argv. `null` when the flag is absent.
 * A bare `--yes-remote` is an empty host and does not match.
 *
 * @param {string[]} argv
 * @returns {string | null}
 */
export function yesRemoteHost(argv) {
  for (const arg of argv) {
    if (arg === "--yes-remote") return "";
    if (arg.startsWith("--yes-remote=")) return arg.slice("--yes-remote=".length);
  }
  return null;
}

/**
 * Whether migrate may open this target. Local targets need no confirmation.
 * A remote host must match `--yes-remote` or the typed prompt exactly.
 * URLs with no confirmable host never connect.
 *
 * @param {{
 *   target: { kind: string, host: string | null },
 *   argv: string[],
 *   isTTY: boolean,
 *   typedHost?: string,
 * }} input
 */
export function remoteMigrationDecision(input) {
  if (input.target.kind === "local") return { connect: true, reason: "local" };
  if (!input.target.host) return { connect: false, reason: "unconfirmed" };
  const flag = yesRemoteHost(input.argv);
  if (flag !== null) {
    return flag === input.target.host
      ? { connect: true, reason: "flag" }
      : { connect: false, reason: "mismatch" };
  }
  if (!input.isTTY || input.typedHost === undefined) {
    return { connect: false, reason: "unconfirmed" };
  }
  return input.typedHost === input.target.host
    ? { connect: true, reason: "prompt" }
    : { connect: false, reason: "mismatch" };
}

async function promptForHost(host) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr,
  });
  try {
    const answer = await rl.question(
      `Migrate a non-local database. Type the host exactly:\n${host}\n`,
    );
    return answer.trim();
  } finally {
    rl.close();
  }
}

function defaultOpen(target, env) {
  return createClient(
    target.kind === "remote"
      ? { url: target.url, authToken: env.DATABASE_AUTH_TOKEN }
      : { url: target.url },
  );
}

function defaultMigrate() {
  const result = spawnSync("pnpm", ["exec", "drizzle-kit", "migrate"], {
    stdio: "inherit",
    env: process.env,
  });
  return result.status ?? 1;
}

/**
 * @param {{
 *   argv?: string[],
 *   env?: Record<string, string | undefined>,
 *   isTTY?: boolean,
 *   ask?: (host: string) => Promise<string>,
 *   open?: (target: object, env: object) => { execute: Function, close: Function },
 *   migrate?: () => number,
 * }} [options]
 * @returns {Promise<number>}
 */
export async function main(options = {}) {
  const argv = (options.argv ?? process.argv.slice(2)).filter((arg) => arg !== "--");
  const env = options.env ?? process.env;
  const isTTY = options.isTTY ?? Boolean(process.stdin.isTTY);
  const ask = options.ask ?? promptForHost;
  const open = options.open ?? defaultOpen;
  const migrate = options.migrate ?? defaultMigrate;
  const target = resolveDbTarget(env);

  if (target.kind !== "local") {
    const flag = yesRemoteHost(argv);
    let typedHost;
    if (flag === null && isTTY && target.host) typedHost = await ask(target.host);
    const decision = remoteMigrationDecision({ target, argv, isTTY, typedHost });
    if (!decision.connect) {
      console.error(REFUSAL);
      return 1;
    }
  }

  const meta = baselineMeta();
  const freshLocal = target.kind === "local" && target.path && !existsSync(target.path);

  if (!freshLocal) {
    if (target.kind === "remote" && !env.DATABASE_AUTH_TOKEN) {
      console.error("DATABASE_AUTH_TOKEN is required to migrate a remote database.");
      return 1;
    }
    if (!target.url) {
      console.error(REFUSAL);
      return 1;
    }

    const client = open(target, env);
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
      return 1;
    }
  }

  return migrate();
}

if (invokedDirectly()) {
  process.exit(await main());
}
