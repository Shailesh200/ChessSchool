import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyCourse, courseDiff, type CourseCounts } from "../src/course";
import { checkCourse } from "../src/course-check";
import { openDb, openReadOnlyDb, type Db } from "../src/db";
import { applyVoice, readVoiceManifests } from "../src/voice";

export const DEFAULT_COURSE_FILE = join(dirname(fileURLToPath(import.meta.url)), "../data/course.json");
export const VOICE_DIR = join(dirname(fileURLToPath(import.meta.url)), "../data/voice");

export type SeedCourseIo = {
  argv?: string[];
  env?: NodeJS.ProcessEnv;
  openDb?: (url: string, authToken?: string) => Promise<Db>;
  openReadOnly?: (url: string, authToken?: string) => Promise<Db>;
  log?: (line: string) => void;
  error?: (line: string) => void;
};

type Args = { file: string; apply: boolean; remoteProd: boolean; confirmVersion?: string; error?: string };

export function parseSeedCourseArgs(argv: string[]): Args {
  const args: Args = { file: DEFAULT_COURSE_FILE, apply: false, remoteProd: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i] ?? "";
    const value = (name: string) => {
      const v = argv[i + 1];
      if (!v || v.startsWith("--")) return void (args.error = `${name} needs a value`);
      i += 1;
      return v;
    };
    if (arg === "--apply") args.apply = true;
    else if (arg === "--remote-prod") args.remoteProd = true;
    else if (arg === "--file") args.file = value("--file") ?? args.file;
    else if (arg === "--confirm-version") args.confirmVersion = value("--confirm-version");
    else args.error = `unknown argument ${arg}`;
    if (args.error) break;
  }
  return args;
}

function printCounts(log: (line: string) => void, apply: boolean, location: string, version: string, lessons: number, counts: CourseCounts) {
  log(apply ? "mode: apply" : "mode: dry-run");
  log(`database: ${location}`);
  log(`version: ${version}`);
  log(`units: ${counts.units}`);
  log(`lessons: ${lessons}`);
  log(`insert: ${counts.insert}`);
  log(`update: ${counts.update}`);
  log(`delete: ${counts.delete}`);
  log(`unchanged: ${counts.unchanged}`);
}

/**
 * Loads data/course.json (or --file) into the course tables. Every lesson is played through with
 * the app's lesson runner first; nothing is written if any lesson fails. Dry-run unless --apply.
 * A remote database needs --remote-prod, and writing to it also needs --confirm-version.
 */
export async function runSeedCourse(io: SeedCourseIo = {}): Promise<number> {
  const log = io.log ?? ((line) => console.log(line));
  const error = io.error ?? ((line) => console.error(line));
  const env = io.env ?? process.env;
  const args = parseSeedCourseArgs(io.argv ?? process.argv.slice(2));
  if (args.error) {
    error(args.error);
    return 1;
  }
  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(args.file, "utf8"));
  } catch {
    error("course file could not be read as JSON");
    return 1;
  }
  const checked = checkCourse(raw);
  if (!checked.ok) {
    for (const issue of checked.errors) error(issue);
    error(`${checked.errors.length} problem(s); nothing written`);
    return 1;
  }
  const doc = checked.doc;
  const url = env.DATABASE_URL;
  const local = Boolean(url?.startsWith("file:"));
  if (!local) {
    if (!url || !args.remoteProd) {
      error("Refusing to run: DATABASE_URL must be a local sqlite file, or pass --remote-prod.");
      return 1;
    }
    if (args.apply && args.confirmVersion !== doc.version) {
      error(`remote apply requires --confirm-version ${doc.version}`);
      return 1;
    }
  }
  let db: Db;
  try {
    db = await (args.apply ? (io.openDb ?? openDb) : (io.openReadOnly ?? openReadOnlyDb))(url!, env.DATABASE_AUTH_TOKEN);
  } catch {
    error("database connection failed");
    return 1;
  }
  let counts: CourseCounts;
  try {
    counts = args.apply ? await applyCourse(db, doc) : await courseDiff(db, doc);
  } catch (err) {
    // Before the first apply the tables may not exist yet: everything is an insert.
    const detail = `${String(err)} ${String((err as { cause?: unknown }).cause ?? "")}`;
    if (args.apply || !/no such table/i.test(detail)) throw err;
    counts = { units: doc.units.length, insert: doc.lessons.length, update: 0, delete: 0, unchanged: 0 };
  }
  printCounts(log, args.apply, local ? "local" : "remote", doc.version, doc.lessons.length, counts);
  const voice = readVoiceManifests(VOICE_DIR);
  if (args.apply && voice.length) {
    for (const [coach, n] of Object.entries(await applyVoice(db, voice))) log(`voice ${coach}: ${n} clips`);
  } else for (const m of voice) log(`voice ${m.coach}: ${Object.keys(m.clips).length} clips (dry-run)`);
  return 0;
}

const launchedDirectly = process.argv[1] ? import.meta.url === pathToFileURL(resolve(process.argv[1])).href : false;
if (launchedDirectly) process.exit(await runSeedCourse());
