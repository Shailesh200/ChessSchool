/**
 * Import a SEPARATE set of homework puzzles from the Lichess DB into the
 * dedicated `homework_lessons` pool — distinct from the curriculum puzzles, so
 * daily homework is never a replay of the school lessons you're grinding.
 *
 *   node scripts/import-homework.mjs lichess_db_puzzle.csv.zst
 *   pnpm db:dump && pnpm db:remote
 *
 * Disjointness: per type we SKIP the first `SKIP_PER_TYPE` matching puzzles (the
 * high-popularity head the curriculum import takes) and collect the next batch.
 * Combined with type-specific themes/ratings, the homework set is effectively
 * disjoint from the curriculum set.
 */
import { spawn } from "node:child_process";
import { createReadStream, existsSync } from "node:fs";
import { createInterface } from "node:readline";
import Database from "better-sqlite3";
import { Chess } from "chess.js";

const INPUT = process.argv[2];
if (!INPUT) {
  console.error("usage: node scripts/import-homework.mjs <lichess_db_puzzle.csv[.zst]>");
  process.exit(1);
}

const PUZZLES_PER = 4; // puzzles in one homework session
const MAX_SESSIONS = 21; // ~3 weeks of daily rotation per type
const SKIP_PER_TYPE = 600; // skip the curriculum's head so puzzles don't overlap
const MIN_POPULARITY = 75;

// Homework type → { themes it draws from, optional rating window }.
const TYPES = {
  warmup: { label: "Warmup", emoji: "🤸", themes: ["oneMove", "mateIn1", "hangingPiece", "fork"], max: 1200 },
  practice: { label: "Tactics", emoji: "🎯", themes: ["fork", "pin", "skewer", "discoveredAttack", "doubleCheck", "deflection"], min: 1100, max: 1900 },
  review: { label: "Checkmate review", emoji: "🔍", themes: ["mateIn2", "mateIn3", "backRankMate", "smotheredMate", "rookEndgame", "endgame"], min: 1200 },
  reflection: { label: "Reflection", emoji: "📝", themes: ["advancedPawn", "promotion", "quietMove", "advantage", "intermezzo", "zugzwang"], min: 1300 },
};
const typeFor = (themes, rating) => {
  for (const [id, t] of Object.entries(TYPES)) {
    if (t.min && rating < t.min) continue;
    if (t.max && rating > t.max) continue;
    if (t.themes.some((x) => themes.includes(x))) return id;
  }
  return null;
};

function lineStream(path) {
  if (!existsSync(path)) {
    console.error(`✗ File not found: ${path}`);
    process.exit(1);
  }
  if (path.endsWith(".zst")) {
    const zstd = spawn("zstd", ["-dc", path]);
    zstd.on("error", (e) => {
      console.error(`✗ Could not run zstd (${e.code || e.message}). brew install zstd (macOS) / apt-get install zstd (Linux), or decompress manually.`);
      process.exit(1);
    });
    return createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  }
  return createInterface({ input: createReadStream(path), crlfDelay: Infinity });
}

const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m.length > 4 ? m[4] : undefined });

/** Turn a Lichess (FEN, UCI moves) puzzle into validated multi-step lesson steps. */
function buildSteps(fen, movesStr, label) {
  const moves = movesStr.trim().split(/\s+/);
  const g = new Chess(fen);
  if (!g.move(uci(moves[0]))) return null; // opponent setup move
  const steps = [];
  for (let i = 1; i < moves.length; i += 2) {
    const mv = uci(moves[i]);
    const before = g.fen();
    if (!g.move(mv)) return null;
    const lastIdx = i + 1 >= moves.length;
    steps.push({
      id: `m${i}`,
      kind: "move",
      coach: i === 1 ? `Your move — find the ${label.toLowerCase()} idea.` : lastIdx ? "Finish it off." : "Good — keep going.",
      fen: before,
      solution: [`${mv.from}:${mv.to}`],
      tag: "homework",
      successText: lastIdx ? "Solved! 🎉" : "Correct!",
    });
    if (moves[i + 1] && !g.move(uci(moves[i + 1]))) return null;
  }
  return steps.length ? steps : null;
}

// ── Scan + bucket ─────────────────────────────────────────────────────────────
const seen = new Map(); // type -> count matched (for skipping the head)
const picked = new Map(); // type -> puzzles[]
const NEED = (MAX_SESSIONS + 2) * PUZZLES_PER;
for (const t of Object.keys(TYPES)) { seen.set(t, 0); picked.set(t, []); }
const done = () => Object.keys(TYPES).every((t) => picked.get(t).length >= NEED);

let scanned = 0;
console.log(`Reading ${INPUT} … homework pool`);
const rl = lineStream(INPUT);
let header = true;
for await (const line of rl) {
  if (header) { header = false; continue; }
  scanned++;
  if (scanned % 500000 === 0) process.stdout.write(`\r  scanned ${scanned.toLocaleString()}…`);
  if (done() || scanned > 6_000_000) break;
  const c = line.split(",");
  if (c.length < 8) continue;
  const rating = Number(c[3]);
  const popularity = Number(c[5]);
  if (!rating || popularity < MIN_POPULARITY) continue;
  const themes = c[7].split(" ");
  const type = typeFor(themes, rating);
  if (!type) continue;
  const n = seen.get(type) + 1;
  seen.set(type, n);
  if (n <= SKIP_PER_TYPE) continue; // skip the curriculum's head
  const arr = picked.get(type);
  if (arr.length >= NEED) continue;
  arr.push({ id: c[0], fen: c[1], moves: c[2], rating });
}
console.log(`\nScanned ${scanned.toLocaleString()} rows.`);

// ── Build homework lessons ────────────────────────────────────────────────────
if (!existsSync("local.db")) {
  console.error("✗ local.db not found. Run `pnpm db:fresh` first.");
  process.exit(1);
}
const db = new Database("local.db");
db.exec(`CREATE TABLE IF NOT EXISTS homework_lessons (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, subtitle TEXT NOT NULL DEFAULT '',
  emoji TEXT NOT NULL DEFAULT '♟️', tag TEXT NOT NULL DEFAULT 'drill', xp INTEGER NOT NULL DEFAULT 20,
  steps TEXT NOT NULL, sort_order INTEGER NOT NULL DEFAULT 0
);`);
db.exec("DELETE FROM homework_lessons");
const insert = db.prepare(
  "INSERT INTO homework_lessons (id, type, title, subtitle, emoji, tag, xp, steps, sort_order) VALUES (?,?,?,?,?,?,?,?,?)",
);

let total = 0;
for (const [type, meta] of Object.entries(TYPES)) {
  const pool = picked.get(type);
  let made = 0;
  for (let i = 0; i < pool.length && made < MAX_SESSIONS; ) {
    const chunk = [];
    while (chunk.length < PUZZLES_PER && i < pool.length) {
      const pz = pool[i++];
      const steps = buildSteps(pz.fen, pz.moves, meta.label);
      if (steps) chunk.push({ pz, steps });
    }
    if (chunk.length < 2) break;
    const steps = chunk.flatMap(({ steps }, k) => steps.map((s, j) => ({ ...s, id: `s${k}_${j}` })));
    insert.run(
      `hw-${type}-${made + 1}`,
      type,
      `${meta.label} #${made + 1}`,
      `${chunk.length}-puzzle ${type} session`,
      meta.emoji,
      type,
      15,
      JSON.stringify(steps),
      made,
    );
    made++;
    total++;
  }
  console.log(`  ${meta.emoji} ${type}: ${made} sessions (${pool.length} puzzles)`);
}
console.log(`✅ Imported ${total} homework lessons into local.db. Next: pnpm db:dump && pnpm db:remote`);
db.close();
