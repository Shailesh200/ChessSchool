/**
 * Build ChessSchool's OWN curated puzzle set from the raw Lichess DB.
 *
 *   node scripts/build-puzzle-set.mjs lichess_db_puzzle.csv.zst
 *   → writes data/chess-school-puzzles.csv.gz  (small, committed to the repo)
 *
 * Quality bar: popularity > 90, plays > 100, no duplicate PuzzleId or FEN+line,
 * up to PER_BUCKET puzzles per (stage × concept). Scans the full dump until every
 * bucket is full or the file ends.
 *
 * Source is Lichess (CC0): https://database.lichess.org/
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  CONCEPT_GROUPS,
  STAGE_BANDS,
  conceptForThemes,
  stageForRating,
} from "@chess-school/puzzle-school";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, "../../..");

const INPUT = process.argv[2];
if (!INPUT) {
  console.error(
    "usage: node scripts/build-puzzle-set.mjs <lichess_db_puzzle.csv[.zst]>",
  );
  process.exit(1);
}

const OUT = join(repoRoot, "data/chess-school-puzzles.csv.gz");
/** Popularity and plays must be STRICTLY above these thresholds. */
const MIN_POPULARITY = 90;
const MIN_PLAYS = 100;
const PER_BUCKET = Number(process.env.PER_BUCKET ?? 800);
const MAX_PLY = Number(process.env.MAX_PLY ?? 12); // skip ultra-long lines

const HEADER =
  "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags";

function lineStream(path) {
  if (!existsSync(path)) {
    console.error(`✗ File not found: ${path}`);
    process.exit(1);
  }
  if (path.endsWith(".zst")) {
    const zstd = spawn("zstd", ["-dc", path]);
    zstd.on("error", (e) => {
      console.error(
        `✗ Could not run zstd (${e.code || e.message}). Install zstd or decompress manually.`,
      );
      process.exit(1);
    });
    return createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  }
  return createInterface({ input: createReadStream(path), crlfDelay: Infinity });
}

const buckets = new Map(); // `${stage}:${concept}` -> lines[]
const seenIds = new Set();
const seenPositions = new Set();
let scanned = 0;
let kept = 0;
let rejected = { quality: 0, theme: 0, dup: 0, long: 0, full: 0 };
const bucketKeys = [];
for (const st of STAGE_BANDS) {
  for (const g of CONCEPT_GROUPS) {
    bucketKeys.push(`${st.id}:${g.id}`);
  }
}
const target = bucketKeys.length * PER_BUCKET;

function bucketFull(key) {
  const arr = buckets.get(key);
  return arr && arr.length >= PER_BUCKET;
}

function allBucketsFull() {
  return bucketKeys.every((k) => bucketFull(k));
}

console.log(
  `Curating from ${INPUT}\n` +
    `  Quality: popularity > ${MIN_POPULARITY}, plays > ${MIN_PLAYS}\n` +
    `  Cap: ${PER_BUCKET} per bucket × ${bucketKeys.length} buckets (max ${target.toLocaleString()})\n` +
    `  Stages: ${STAGE_BANDS.map((s) => s.id).join(", ")}\n` +
    `  Concepts: ${CONCEPT_GROUPS.map((g) => g.id).join(", ")}`,
);

const rl = lineStream(INPUT);
let header = true;
for await (const line of rl) {
  if (header) {
    header = false;
    continue;
  }
  scanned++;
  if (scanned % 500000 === 0) {
    const filled = bucketKeys.filter((k) => bucketFull(k)).length;
    process.stdout.write(
      `\r  scanned ${scanned.toLocaleString()} · kept ${kept.toLocaleString()} · buckets ${filled}/${bucketKeys.length} full…`,
    );
  }
  if (allBucketsFull()) break;

  const c = line.split(",");
  if (c.length < 8) continue;

  const puzzleId = c[0];
  const fen = c[1];
  const moves = c[2].trim();
  const rating = Number(c[3]);
  const popularity = Number(c[5]);
  const plays = Number(c[6]);

  if (!rating || popularity <= MIN_POPULARITY || plays <= MIN_PLAYS) {
    rejected.quality++;
    continue;
  }

  const moveCount = moves.split(/\s+/).filter(Boolean).length;
  if (moveCount > MAX_PLY) {
    rejected.long++;
    continue;
  }

  const themes = c[7].split(" ");
  const group = conceptForThemes(themes);
  if (!group) {
    rejected.theme++;
    continue;
  }

  const stage = stageForRating(rating);
  const key = `${stage.id}:${group.id}`;
  if (bucketFull(key)) {
    rejected.full++;
    continue;
  }

  if (seenIds.has(puzzleId)) {
    rejected.dup++;
    continue;
  }
  const posKey = `${fen}|${moves}`;
  if (seenPositions.has(posKey)) {
    rejected.dup++;
    continue;
  }

  let arr = buckets.get(key);
  if (!arr) {
    arr = [];
    buckets.set(key, arr);
  }
  arr.push(line);
  seenIds.add(puzzleId);
  seenPositions.add(posKey);
  kept++;
}

console.log(
  `\nScanned ${scanned.toLocaleString()} rows · curated ${kept.toLocaleString()} across ${buckets.size} buckets.`,
);
console.log(
  `  Rejected: quality ${rejected.quality.toLocaleString()}, no theme ${rejected.theme.toLocaleString()}, dup ${rejected.dup.toLocaleString()}, long line ${rejected.long.toLocaleString()}, bucket full ${rejected.full.toLocaleString()}`,
);

const unfilled = bucketKeys.filter((k) => !bucketFull(k));
if (unfilled.length) {
  console.warn(
    `\n⚠ ${unfilled.length} buckets below ${PER_BUCKET}:`,
    unfilled.slice(0, 8).join(", "),
    unfilled.length > 8 ? "…" : "",
  );
}

mkdirSync(join(repoRoot, "data"), { recursive: true });
const rows = [HEADER, ...[...buckets.values()].flat()];
await pipeline(
  Readable.from(rows.map((r) => r + "\n")),
  createGzip({ level: 9 }),
  createWriteStream(OUT),
);

const mb = (rows.length / 1024).toFixed(0);
console.log(
  `✅ Wrote ${OUT} (${kept.toLocaleString()} puzzles, ~${mb}k rows uncompressed).\n` +
    `   Next: pnpm puzzle-school adapt-csv && pnpm --filter web db:import-puzzle-school`,
);
