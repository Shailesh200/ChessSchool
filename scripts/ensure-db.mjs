/**
 * First-run guard: make sure the database exists and is seeded before the app
 * starts. Lets a single command (`pnpm dev`) bring up FE + BE + DB together.
 * On subsequent runs it's a sub-millisecond check and skips straight to the app.
 */
import { existsSync } from "node:fs";
import { execSync } from "node:child_process";
import Database from "better-sqlite3";

const path = (process.env.DATABASE_URL ?? "local.db").replace(/^file:/, "");

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

if (ready()) {
  console.log("✓ Database ready.");
} else {
  console.log("⚙️  First run — setting up the database (tables + lessons)…");
  execSync("pnpm db:push", { stdio: "inherit" });
  execSync("pnpm db:seed", { stdio: "inherit" });
  console.log("✓ Database ready.");
}
