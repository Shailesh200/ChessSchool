/**
 * First-run guard: apply committed migrations and seed lessons before the app
 * starts. Lets `pnpm dev` bring up FE + BE + DB together.
 *
 * A remote DATABASE_URL is left alone. Production migrations are explicit
 * (`pnpm db:migrate` after `pnpm db:baseline` on a database that already has tables).
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";
import { baselineCovers, baselineMeta, resolveDbTarget } from "./drizzle-baseline.mjs";

const target = resolveDbTarget();

if (target.kind === "remote") {
  console.log(
    "✓ Remote DATABASE_URL set — skipping local migrate/seed. Apply schema with pnpm db:baseline, then pnpm db:migrate.",
  );
  process.exit(0);
}

const path = target.path;
const meta = baselineMeta();

function ready() {
  if (!existsSync(path)) return false;
  try {
    const db = new Database(path, { readonly: true });
    const row = db.prepare("SELECT COUNT(*) AS c FROM lessons").get();
    db.close();
    return row && row.c > 0;
  } catch {
    return false;
  }
}

function needsLocalBaseline() {
  if (!existsSync(path)) return false;
  const db = new Database(path, { readonly: true });
  try {
    const hasUsers = db
      .prepare(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = 'users'",
      )
      .get();
    if (!hasUsers) return false;
    const hasJournal = db
      .prepare(
        "SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = '__drizzle_migrations'",
      )
      .get();
    if (!hasJournal) return true;
    const latest = db
      .prepare(
        "SELECT created_at FROM __drizzle_migrations ORDER BY created_at DESC LIMIT 1",
      )
      .get();
    return !latest || !baselineCovers(latest.created_at, meta.entry.when);
  } finally {
    db.close();
  }
}

if (needsLocalBaseline()) {
  console.log(
    "⚙️  Existing local database has no baseline journal row — recording 0000 without replaying CREATE TABLE…",
  );
  execSync("node scripts/mark-baseline-applied.mjs --apply", { stdio: "inherit" });
}

console.log("⚙️  Applying migrations…");
execSync("pnpm db:migrate", { stdio: "inherit" });

if (!ready()) {
  console.log("⚙️  Seeding lessons…");
  execSync("pnpm db:seed", { stdio: "inherit" });
}

console.log("✓ Database ready.");
