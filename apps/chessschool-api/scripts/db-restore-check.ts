/**
 * Backup drill for the production database. Reads every table through a READ-ONLY token, copies it into a
 * local sqlite file, and checks row counts and the schema against BOOTSTRAP_SQL. It never writes to the source.
 *
 *   SOURCE_DB_URL=libsql://… SOURCE_DB_TOKEN=<read-only token> pnpm --filter chessschool-api run db:restore-check
 *   SOURCE_DB_URL=file:./local.db pnpm --filter chessschool-api run db:restore-check   (dry run on a local file)
 */
import { rmSync } from "node:fs";
import { createClient } from "@libsql/client";
import { restoreCheck } from "../src/restore-check";

const url = process.env.SOURCE_DB_URL;
if (!url) {
  console.error("SOURCE_DB_URL is not set");
  process.exit(1);
}
const out = process.env.RESTORE_FILE ?? "restore-check.db";
rmSync(out, { force: true });
const report = await restoreCheck(createClient({ url, authToken: process.env.SOURCE_DB_TOKEN }), createClient({ url: `file:${out}` }), createClient({ url: ":memory:" }));
for (const t of report.tables) console.log(`${t.name.padEnd(28)} ${String(t.copied).padStart(8)} rows`);
console.log(`${report.tables.length} tables, ${report.tables.reduce((n, t) => n + t.copied, 0)} rows copied to ${out}`);
if (!process.env.KEEP_RESTORE) rmSync(out, { force: true });
// The backup job sets ROWS_ONLY=1: a schema the live API has not caught up with yet (a new table before a deploy)
// must not stop the nightly backup, but a table that did not copy in full must.
const schemaOnly = (p: string) => /: (table|column) is missing$/.test(p);
const problems = process.env.ROWS_ONLY ? report.problems.filter((p) => !schemaOnly(p)) : report.problems;
for (const p of report.problems.filter((p) => !problems.includes(p))) console.warn(`WARNING ${p}`);
if (problems.length) {
  for (const p of problems) console.error(`PROBLEM ${p}`);
  process.exit(1);
}
console.log("restore check passed");
