/**
 * Import premium puzzles from the open Lichess puzzle database into the curriculum.
 *
 *   1. Download (on a network that allows it — the office proxy 403s database.lichess.org):
 *        curl -L -o lichess_db_puzzle.csv.zst https://database.lichess.org/lichess_db_puzzle.csv.zst
 *   2. Run:  node scripts/import-lichess.mjs lichess_db_puzzle.csv.zst
 *      (accepts .csv or .csv.zst — .zst is streamed through `zstd -dc`)
 *   3. pnpm db:dump   (regenerate db/seed.sql)  then  pnpm db:remote   (push to Turso, off-network)
 *
 * Each Lichess puzzle is a real-game position rated 400–3000 and tagged by theme.
 * We bucket them by (school stage ← rating) × (concept ← theme) so difficulty rises
 * with the school level and every class drills one concept. Each puzzle becomes ONE
 * lesson; multi-move puzzles become multi-step lessons (you play, the opponent's reply
 * is auto-applied, you play the next move…). Every line is re-validated with chess.js.
 */
import { spawn } from "node:child_process";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import Database from "better-sqlite3";
import { Chess } from "chess.js";

const INPUT = process.argv[2];
const TARGET_TOTAL = Number(process.env.LIMIT ?? 5200); // ~5000+ premium lessons
const PER_CLASS = 18; // puzzles (lessons) per class
const MIN_POPULARITY = 80; // Lichess popularity score 0–100; keep well-liked puzzles
if (!INPUT) {
  console.error("usage: node scripts/import-lichess.mjs <lichess_db_puzzle.csv[.zst]>");
  process.exit(1);
}

// ── Curriculum mapping ───────────────────────────────────────────────────────
const STAGE = (r) =>
  r < 1000 ? { id: "elementary", title: "Elementary", order: 0 }
  : r < 1350 ? { id: "middle", title: "Middle School", order: 1 }
  : r < 1700 ? { id: "high", title: "High School", order: 2 }
  : r < 2100 ? { id: "university", title: "University", order: 3 }
  : { id: "master", title: "Masters", order: 4 };

// First matching group wins (ordered by teaching priority).
const GROUPS = [
  { id: "mate", label: "Checkmates", emoji: "♚", color: "#dc2626", themes: ["mateIn1", "mateIn2", "mateIn3", "mateIn4", "mateIn5", "backRankMate", "smotheredMate", "mate", "hookMate", "anastasiaMate", "arabianMate", "bodenMate"] },
  { id: "fork", label: "Forks", emoji: "🍴", color: "#ea580c", themes: ["fork"] },
  { id: "pin", label: "Pins & Skewers", emoji: "📌", color: "#d97706", themes: ["pin", "skewer"] },
  { id: "discovered", label: "Discovered Attacks", emoji: "🎯", color: "#7c3aed", themes: ["discoveredAttack", "doubleCheck"] },
  { id: "sacrifice", label: "Sacrifices & Combinations", emoji: "🔥", color: "#db2777", themes: ["sacrifice", "attraction", "deflection", "clearance", "interference", "decoy", "attackingF2F7"] },
  { id: "trapped", label: "Win Material", emoji: "💰", color: "#16a34a", themes: ["hangingPiece", "capturingDefender", "trappedPiece", "win"] },
  { id: "endgame", label: "Endgames", emoji: "♔", color: "#0891b2", themes: ["endgame", "rookEndgame", "pawnEndgame", "queenEndgame", "bishopEndgame", "knightEndgame", "queenRookEndgame", "zugzwang", "promotion", "advancedPawn"] },
  { id: "advantage", label: "Convert the Advantage", emoji: "📈", color: "#2563eb", themes: ["advantage", "crushing", "defensiveMove", "quietMove", "intermezzo"] },
];
const groupFor = (themes) => GROUPS.find((g) => g.themes.some((t) => themes.includes(t)));

const TUTORIALS = {
  mate: "A checkmate attacks the king so it has no legal escape. Look for forcing checks first, and watch how the enemy king's escape squares are cut off.",
  fork: "A fork is one piece attacking two targets at once. Knights are the classic forkers — aim at the king plus a queen or rook so your opponent can only save one.",
  pin: "A pin freezes a piece in front of a more valuable one. A skewer is the reverse — hit the valuable piece so it must move and you win what's behind it.",
  discovered: "A discovered attack moves one piece to unveil an attack from another. A discovered check is brutal: you check the king and grab material on the same move.",
  sacrifice: "A sacrifice gives up material for a bigger gain — a mating attack or a winning combination. Calculate the forcing line to the very end before you commit.",
  trapped: "Winning material starts with spotting undefended or overloaded pieces. Capture defenders, trap pieces with no squares, and never leave a piece hanging.",
  endgame: "Endgames are about precision: activate your king, push passed pawns, and use opposition and zugzwang. Small edges convert into wins with accurate technique.",
  advantage: "When you're ahead, convert cleanly: trade pieces (not pawns), improve your worst piece, and avoid counterplay. Quiet, accurate moves win won positions.",
};

// ── CSV stream ───────────────────────────────────────────────────────────────
function lineStream(path) {
  if (path.endsWith(".zst")) {
    const zstd = spawn("zstd", ["-dc", path]);
    zstd.stderr.on("data", () => {});
    return createInterface({ input: zstd.stdout, crlfDelay: Infinity });
  }
  return createInterface({ input: createReadStream(path), crlfDelay: Infinity });
}

const uci = (m) => ({ from: m.slice(0, 2), to: m.slice(2, 4), promotion: m.length > 4 ? m[4] : undefined });

/** Turn a Lichess (FEN, UCI moves) puzzle into validated multi-step lesson steps. */
function buildSteps(fen, movesStr, group) {
  const moves = movesStr.trim().split(/\s+/);
  const g = new Chess(fen);
  // Moves[0] is the opponent's setup move that creates the puzzle.
  if (!g.move(uci(moves[0]))) return null;
  const steps = [];
  for (let i = 1; i < moves.length; i += 2) {
    const mv = uci(moves[i]);
    const before = g.fen();
    const applied = g.move(mv);
    if (!applied) return null;
    const lastIdx = i + 1 >= moves.length;
    const coach =
      i === 1
        ? `Your move. Find the ${group.label.toLowerCase().replace(/s$/, "")} idea.`
        : lastIdx
          ? "Finish it off — find the final move."
          : "Good. Now find the next move in the combination.";
    steps.push({
      id: `m${i}`,
      kind: "move",
      coach,
      fen: before,
      solution: [`${mv.from}:${mv.to}`],
      tag: group.id,
      successText: lastIdx ? "Solved! 🎉" : "Correct — keep going!",
    });
    // Auto-apply the opponent's forced reply so the next step continues the line.
    if (moves[i + 1] && !g.move(uci(moves[i + 1]))) return null;
  }
  return steps.length ? steps : null;
}

// ── Bucketize while streaming (cap per bucket to bound memory) ────────────────
const PER_BUCKET_CAP = Math.ceil(TARGET_TOTAL / (GROUPS.length * 3)) + PER_CLASS * 4;
const buckets = new Map(); // key `${stage}:${group}` -> puzzles[]
let scanned = 0;
let kept = 0;

console.log(`Reading ${INPUT} … target ${TARGET_TOTAL} puzzles`);
const rl = lineStream(INPUT);
let header = true;
for await (const line of rl) {
  if (header) { header = false; continue; } // PuzzleId,FEN,Moves,Rating,RatingDeviation,Popularity,NbPlays,Themes,GameUrl,OpeningTags
  scanned++;
  if (kept >= TARGET_TOTAL * 1.4) break; // collected enough to fill buckets
  const c = line.split(",");
  if (c.length < 8) continue;
  const rating = Number(c[3]);
  const popularity = Number(c[5]);
  if (!rating || popularity < MIN_POPULARITY) continue;
  const themes = c[7].split(" ");
  if (themes.includes("oneMove") && Math.random() < 0.4) continue; // de-emphasize trivial 1-movers
  const group = groupFor(themes);
  if (!group) continue;
  const stage = STAGE(rating);
  const key = `${stage.id}:${group.id}`;
  let arr = buckets.get(key);
  if (!arr) { arr = []; buckets.set(key, arr); }
  if (arr.length >= PER_BUCKET_CAP) continue;
  arr.push({ id: c[0], fen: c[1], moves: c[2], rating, themes, stage, group });
  kept++;
}
console.log(`Scanned ${scanned} rows, collected ${kept} candidates across ${buckets.size} buckets.`);

// ── Build semesters/classes/lessons + validate ───────────────────────────────
const semesters = [];
const classes = [];
const lessons = [];
let total = 0;
let invalid = 0;
let sortClass = 0;

for (const g of GROUPS) {
  for (const st of [STAGE(700), STAGE(1100), STAGE(1500), STAGE(1900), STAGE(2300)]) {
    const arr = buckets.get(`${st.id}:${g.id}`);
    if (!arr || arr.length < 3) continue;
    arr.sort((a, b) => a.rating - b.rating); // easy → hard within the concept
    const semId = `pz-${st.id}-${g.id}`;
    semesters.push({ id: semId, title: `${st.title}: ${g.label}`, blurb: `${g.label} from real games`, color: g.color, stage: st.id, sortOrder: st.order * 10 + GROUPS.indexOf(g) });

    let made = [];
    for (const pz of arr) {
      const steps = buildSteps(pz.fen, pz.moves, g);
      if (!steps) { invalid++; continue; }
      made.push({ pz, steps });
      if (made.length >= TARGET_TOTAL) break;
    }
    // chunk into classes
    for (let ci = 0; ci * PER_CLASS < made.length; ci++) {
      const slice = made.slice(ci * PER_CLASS, (ci + 1) * PER_CLASS);
      if (!slice.length) break;
      const classId = `${semId}-c${ci + 1}`;
      const difficulty = Math.min(6, st.order + 1 + Math.floor(ci / 3));
      classes.push({ id: classId, semesterId: semId, title: `${g.label} ${ci + 1}`, emoji: g.emoji, blurb: `${slice.length} puzzles`, difficulty, sortOrder: sortClass++ });
      // Lesson 1 of every class: the hand-authored concept tutorial.
      lessons.push({
        id: `${classId}-tutorial`, classId, title: `${g.label}: the idea`, subtitle: "Tutorial", emoji: "🎓",
        tag: g.id, xp: 15, isExam: 0, prerequisites: "[]", sortOrder: 0,
        steps: JSON.stringify([{ id: "t", kind: "info", coach: TUTORIALS[g.id], fen: slice[0].steps[0].fen }]),
      });
      slice.forEach(({ pz, steps }, li) => {
        lessons.push({
          id: `${classId}-l${li + 1}`, classId,
          title: `${g.label} · ${pz.rating}`,
          subtitle: `${Math.ceil(steps.length)} move${steps.length > 1 ? "s" : ""}`,
          emoji: g.emoji, tag: g.id, xp: 10 + steps.length * 4, isExam: 0, prerequisites: "[]",
          steps: JSON.stringify(steps), sortOrder: li + 1,
        });
        total++;
      });
    }
  }
}

console.log(`Built ${lessons.length} lessons (${total} puzzles + tutorials) · ${classes.length} classes · ${semesters.length} semesters · invalid skipped: ${invalid}`);

// ── Write into local.db (replaces a prior import; leaves seed.mjs content intact) ──
const db = new Database("local.db");
db.exec("DELETE FROM lessons WHERE class_id LIKE 'pz-%'; DELETE FROM classes WHERE id LIKE 'pz-%'; DELETE FROM semesters WHERE id LIKE 'pz-%';");
const insSem = db.prepare("INSERT INTO semesters (id,title,blurb,color,stage,sort_order) VALUES (@id,@title,@blurb,@color,@stage,@sortOrder)");
const insCls = db.prepare("INSERT INTO classes (id,semester_id,title,emoji,blurb,difficulty,sort_order) VALUES (@id,@semesterId,@title,@emoji,@blurb,@difficulty,@sortOrder)");
const insLes = db.prepare("INSERT INTO lessons (id,class_id,title,subtitle,emoji,tag,xp,is_exam,prerequisites,steps,sort_order) VALUES (@id,@classId,@title,@subtitle,@emoji,@tag,@xp,@isExam,@prerequisites,@steps,@sortOrder)");
const tx = db.transaction(() => {
  for (const s of semesters) insSem.run(s);
  for (const c of classes) insCls.run(c);
  for (const l of lessons) insLes.run(l);
});
tx();
console.log(`✅ Imported into local.db. Next: pnpm db:dump && pnpm db:remote`);
