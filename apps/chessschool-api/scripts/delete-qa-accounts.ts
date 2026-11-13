import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { pathToFileURL } from "node:url";
import { openDb, openReadOnlyDb, type Db } from "../src/db";
import { confirmMatches, lockReadsOnly, parseAllowList, parseCleanupArgs, resolveDbTarget, runQaCleanup, type QaReport } from "../src/qa-accounts";

export type CleanupIo = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  openDb?: (url: string, authToken?: string) => Promise<Db>;
  openReadOnly?: (url: string, authToken?: string) => Promise<Db>;
  isTTY?: boolean;
  readLine?: () => Promise<string>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

function printReport(log: (line: string) => void, error: (line: string) => void, rejected: string[], report: QaReport, apply: boolean, location: "local" | "remote") {
  log(apply && !report.refused ? "mode: apply" : "mode: dry-run");
  log(`database: ${location}`);
  log(`rejected: ${rejected.length}`);
  for (const email of rejected) log(`rejected-email: ${email}`);
  log(`found: ${report.found.length}`);
  for (const row of report.found) log(`found-email: ${row.email}`);
  log(`missing: ${report.missing.length}`);
  for (const email of report.missing) log(`missing-email: ${email}`);
  log(`unlisted: ${report.unlisted.length}`);
  for (const email of report.unlisted) log(`unlisted-email: ${email}`);
  if (report.refused) {
    error(`refusing: ${report.refused}`);
    log("deleted: 0");
    log("no accounts deleted");
    return;
  }
  log(`deleted: ${report.deleted.length}`);
  for (const email of report.deleted) log(`deleted-email: ${email}`);
  if (!apply || report.deleted.length === 0) log("no accounts deleted");
}

/** Runs the cleanup. A remote dry-run only reads. A remote delete waits for the exact matched count. */
export async function runDeleteQaAccounts(io: CleanupIo = {}): Promise<number> {
  const log = io.log ?? ((line) => console.log(line));
  const error = io.error ?? ((line) => console.error(line));
  const env = io.env ?? process.env;
  const args = parseCleanupArgs(io.argv ?? process.argv.slice(2));
  if (args.error || !args.list) {
    error(args.error ?? "--list is required");
    return 1;
  }

  let markdown: string;
  try {
    markdown = readFileSync(args.list, "utf8");
  } catch {
    error("allow-list could not be read");
    return 1;
  }
  const list = parseAllowList(markdown);
  if (list.error) {
    error(list.error);
    return 1;
  }

  const target = resolveDbTarget(env.DATABASE_URL, args.remoteProd);
  if (!target.ok) {
    error(target.message);
    return 1;
  }

  let db: Db;
  try {
    const opener = args.apply ? (io.openDb ?? openDb) : (io.openReadOnly ?? openReadOnlyDb);
    db = await opener(target.url, env.DATABASE_AUTH_TOKEN);
  } catch {
    error("database connection failed");
    return 1;
  }

  const guard = target.location === "remote" && !args.apply ? lockReadsOnly(db) : null;
  let planned;
  try {
    planned = await runQaCleanup(db, { emails: list.emails, apply: false, max: args.max });
  } finally {
    guard?.restore();
  }
  if (planned.refused || !args.apply) {
    printReport(log, error, list.rejected, planned, false, target.location);
    return planned.refused ? 1 : 0;
  }

  if (target.location === "remote") {
    const isTTY = io.isTTY ?? Boolean(stdin.isTTY);
    const typed = args.confirmCount ?? (isTTY ? await (io.readLine ?? readConfirmLine)() : undefined);
    if (!confirmMatches(typed, planned.found.length)) {
      error("aborted: confirmation does not match the matched count");
      log("database: remote");
      log("deleted: 0");
      log("no accounts deleted");
      return 1;
    }
  }

  const deleted = await runQaCleanup(db, { emails: planned.found.map((row) => row.email), apply: true, max: args.max });
  printReport(log, error, list.rejected, { ...planned, deleted: deleted.deleted }, true, target.location);
  return deleted.refused ? 1 : 0;
}

async function readConfirmLine(): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question("Type the matched count: ");
  } finally {
    rl.close();
  }
}

const launchedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (launchedDirectly) process.exit(await runDeleteQaAccounts());
