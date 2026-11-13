import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { openDb, openReadOnlyDb, type Db } from "../src/db";
import { applyPuzzlePack, parsePuzzlePack, puzzleDiff, readPuzzleRows, type PuzzleCounts } from "../src/puzzles";

export type SeedIo = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  openDb?: (url: string, authToken?: string) => Promise<Db>;
  openReadOnly?: (url: string, authToken?: string) => Promise<Db>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

type SeedArgs = { file?: string; apply: boolean; remoteProd: boolean; confirmVersion?: string; error?: string };

export function parseSeedArgs(argv: string[]): SeedArgs {
  let file: string | undefined;
  let apply = false;
  let remoteProd = false;
  let confirmVersion: string | undefined;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    if (arg === "--apply") apply = true;
    else if (arg === "--remote-prod") remoteProd = true;
    else if (arg === "--file") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { apply, remoteProd, error: "--file is required" };
      file = value;
      i += 1;
    } else if (arg.startsWith("--file=")) file = arg.slice("--file=".length);
    else if (arg === "--confirm-version") {
      const value = argv[i + 1];
      if (!value || value.startsWith("--")) return { apply, remoteProd, error: "--confirm-version needs the pack version" };
      confirmVersion = value;
      i += 1;
    } else if (arg.startsWith("--confirm-version=")) confirmVersion = arg.slice("--confirm-version=".length);
    else return { apply, remoteProd, error: "unknown argument" };
  }
  if (!file) return { apply, remoteProd, confirmVersion, error: "--file is required" };
  return { file, apply, remoteProd, confirmVersion };
}

function printCounts(log: (line: string) => void, location: "local" | "remote", version: string, counts: PuzzleCounts, apply: boolean) {
  log(apply ? "mode: apply" : "mode: dry-run");
  log(`database: ${location}`);
  log(`version: ${version}`);
  log(`insert: ${counts.insert}`);
  log(`update: ${counts.update}`);
  log(`delete: ${counts.delete}`);
}

/** Dry-run reads with openReadOnlyDb. --apply writes. A remote URL stays closed unless --remote-prod --apply --confirm-version match. */
export async function runSeedPuzzles(io: SeedIo = {}): Promise<number> {
  const log = io.log ?? ((line) => console.log(line));
  const error = io.error ?? ((line) => console.error(line));
  const env = io.env ?? process.env;
  const args = parseSeedArgs(io.argv ?? process.argv.slice(2));
  if (args.error || !args.file) {
    error(args.error ?? "--file is required");
    return 1;
  }
  let raw: string;
  try {
    raw = readFileSync(args.file, "utf8");
  } catch {
    error("pack file could not be read");
    return 1;
  }
  const parsed = parsePuzzlePack(raw);
  if (!parsed.ok) {
    for (const issue of parsed.errors) error(issue);
    return 1;
  }
  const url = env.DATABASE_URL;
  const remote = Boolean(url && !url.startsWith("file:"));
  if (!url?.startsWith("file:")) {
    if (!args.remoteProd) {
      error("Refusing to run: DATABASE_URL must be a local sqlite file.");
      return 1;
    }
    if (!args.apply || args.confirmVersion !== parsed.pack.version) {
      error("remote seed requires --apply and --confirm-version matching the pack");
      return 1;
    }
  }
  let db: Db;
  try {
    const opener = args.apply ? (io.openDb ?? openDb) : (io.openReadOnly ?? openReadOnlyDb);
    db = await opener(url!, env.DATABASE_AUTH_TOKEN);
  } catch {
    error("database connection failed");
    return 1;
  }
  const counts = puzzleDiff(await readPuzzleRows(db), parsed.pack).counts;
  if (args.apply) await applyPuzzlePack(db, parsed.pack);
  printCounts(log, remote ? "remote" : "local", parsed.pack.version, counts, args.apply);
  return 0;
}

const launchedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (launchedDirectly) process.exit(await runSeedPuzzles());
