import { readFileSync } from "node:fs";
import { openDb } from "../src/db";
import { parseAllowList, parseCleanupArgs, runQaCleanup, type QaReport } from "../src/qa-accounts";

function localFileUrl(raw: string | undefined): string | null {
  if (!raw || !raw.startsWith("file:")) return null;
  return raw;
}

function printReport(rejected: string[], report: QaReport, apply: boolean) {
  console.log(apply && !report.refused ? "mode: apply" : "mode: dry-run");
  console.log(`rejected: ${rejected.length}`);
  for (const email of rejected) console.log(`rejected-email: ${email}`);
  console.log(`found: ${report.found.length}`);
  for (const row of report.found) console.log(`found-email: ${row.email}`);
  console.log(`missing: ${report.missing.length}`);
  for (const email of report.missing) console.log(`missing-email: ${email}`);
  console.log(`unlisted: ${report.unlisted.length}`);
  for (const email of report.unlisted) console.log(`unlisted-email: ${email}`);
  if (report.refused) {
    console.error(`refusing: ${report.refused}`);
    console.log("deleted: 0");
    console.log("no accounts deleted");
    return;
  }
  console.log(`deleted: ${report.deleted.length}`);
  for (const email of report.deleted) console.log(`deleted-email: ${email}`);
  if (!apply) console.log("no accounts deleted");
}

const args = parseCleanupArgs(process.argv.slice(2));
if (args.error || !args.list) {
  console.error(args.error ?? "--list is required");
  process.exit(1);
}

let markdown: string;
try {
  markdown = readFileSync(args.list, "utf8");
} catch {
  console.error("allow-list could not be read");
  process.exit(1);
}

const list = parseAllowList(markdown);
if (list.error) {
  console.error(list.error);
  process.exit(1);
}

const url = localFileUrl(process.env.DATABASE_URL);
if (!url) {
  console.error("Refusing to run: DATABASE_URL must be a local sqlite file.");
  process.exit(1);
}

const db = await openDb(url);
const report = await runQaCleanup(db, { emails: list.emails, apply: args.apply, max: args.max });
printReport(list.rejected, report, args.apply);
if (report.refused) process.exit(1);
