/**
 * Build ChessSchool's OWN curated puzzle set from the raw Lichess DB.
 *
 *   node scripts/build-puzzle-set.mjs lichess_db_puzzle.csv.zst
 *   → writes data/chess-school-puzzles.csv.gz  (small, committed to the repo)
 *
 * We pick a quality-filtered, BALANCED spread across our school stages (← rating)
 * and teaching concepts (← themes), so the committed file is a few-MB dataset we
 * own — after this one-time build, `pnpm db:import-puzzles` / `db:import-homework`
 * read our file with no 300 MB download or external tools required (gzip is
 * built into Node; only the raw Lichess source needs `zstd`).
 *
 * Source is Lichess (CC0): https://database.lichess.org/  — free to reuse.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync, mkdirSync } from "node:fs";
import { createWriteStream } from "node:fs";
import { createInterface } from "node:readline";
import { createGzip } from "node:zlib";
import { pipeline } from "node:stream/promises";
import { Readable } from "node:stream";

const INPUT = process.argv[2];
if (!INPUT) {
  console.error("usage: node scripts/build-puzzle-set.mjs <lichess_db_puzzle.csv[.zst]>");
  process.exit(1);
}

const OUT = "data/chess-school-puzzles.csv.gz";
const MIN_POPULARITY = 70;
const MIN_PLAYS = 40;
const PER_BUCKET = 420; // per (stage × concept); ~14k total leaves room for homework's disjoint slice

const STAGE = (r) =>
  r < 1000 ? "elementary" : r < 1350 ? "middle" : r < 1700 ? "high" : r < 2100 ? "university" : "master";

const CONCEPTS = [
  { id: "mate", themes: ["mateIn1", "mateIn2", "mateIn3", "backRankMate", "smotheredMate", "mate", "hookMate", "anastasiaMate", "arabianMate"] },
  { id: "fork", themes: ["fork"] },
  { id: "pin", themes: ["pin", "skewer"] },
  { id: "discovered", themes: ["discoveredAttack", "doubleCheck"] },
  { id: "sacrifice", themes: ["sacrifice", "attraction", "deflection", "clearance", "interference", "decoy", "attackingF2F7"] },
  { id: "trapped", themes: ["hangingPiece", "capturingDefender", "trappedPiece", "win"] },
  { id: "endgame", themes: ["endgame", "rookEndgame", "pawnEndgame", "queenEndgame", "bishopEndgame", "knightEndgame", "zugzwang", "promotion", "advancedPawn"] },
  { id: "advantage", themes: ["advantage", "crushing", "defensiveMove", "quietMove", "intermezzo"] },
];
const conceptOf = (themes) => CONCEPTS.find((c) => c.themes.some((t) => themes.includes(t)))?.id ?? null;

function lineStream(path) {
  if (!existsSync(path)) {
    console.error(`✗ File not found: ${path}`);
    process.exit(1);
  }
  if (path.endsWith(".zst")) {
    const zstd = spawn("zstd", ["-dc", path]);
    zstd.on("error", (e) => {
      console.error(`✗ Could not run zstd (${e.code || e.message}). brew install zstd / apt-get install zstd, or decompress manually.`);
      process.exit(1);
    });
    return createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  }
  return createInterface({ input: createReadStream(path), crlfDelay: Infinity });
}

const HEADER = "PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags";
const buckets = new Map(); // `${stage}:${concept}` -> verbatim lines[]
let scanned = 0;
let kept = 0;
const target = CONCEPTS.length * 5 * PER_BUCKET;

console.log(`Curating from ${INPUT} … target ~${target} puzzles`);
const rl = lineStream(INPUT);
let header = true;
for await (const line of rl) {
  if (header) { header = false; continue; }
  scanned++;
  if (scanned % 500000 === 0) process.stdout.write(`\r  scanned ${scanned.toLocaleString()} · kept ${kept}…`);
  if (kept >= target) break;
  const c = line.split(",");
  if (c.length < 8) continue;
  const rating = Number(c[3]);
  const popularity = Number(c[5]);
  const plays = Number(c[6]);
  if (!rating || popularity < MIN_POPULARITY || plays < MIN_PLAYS) continue;
  const themes = c[7].split(" ");
  const concept = conceptOf(themes);
  if (!concept) continue;
  const key = `${STAGE(rating)}:${concept}`;
  let arr = buckets.get(key);
  if (!arr) { arr = []; buckets.set(key, arr); }
  if (arr.length >= PER_BUCKET) continue;
  arr.push(line);
  kept++;
}
console.log(`\nScanned ${scanned.toLocaleString()} rows, curated ${kept} across ${buckets.size} buckets.`);

mkdirSync("data", { recursive: true });
const rows = [HEADER, ...[...buckets.values()].flat()];
await pipeline(Readable.from(rows.map((r) => r + "\n")), createGzip({ level: 9 }), createWriteStream(OUT));
console.log(`✅ Wrote ${OUT} (${kept} puzzles). Commit it, then:  pnpm db:import-puzzles  &&  pnpm db:import-homework`);
