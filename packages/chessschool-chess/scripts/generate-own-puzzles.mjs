#!/usr/bin/env node
/**
 * Generate original ChessSchool puzzles from Stockfish self-play.
 *
 * Positions come from games this script plays with the Stockfish 18 lite WASM
 * already in the repo (apps/web/public/engine/stockfish-18-lite-single.js,
 * GPLv3). No puzzle database is read. Same seed + same engine build => same
 * games, because every search is one thread, a fixed depth (no movetime), and
 * a cleared hash.
 *
 *   node packages/chessschool-chess/scripts/generate-own-puzzles.mjs \
 *     --count 20 --seed 20261113 --games 48 --pool 140 \
 *     --out docs/own-puzzles-sample.json
 *
 *   node packages/chessschool-chess/scripts/generate-own-puzzles.mjs --check
 *
 * Output rows use the same tuple the app already reads:
 *   [id, fen, uci moves, rating, theme indexes]
 * Theme index order is THEMES below (identical to PUZZLE_THEME_TAGS).
 * The first UCI move is the opponent's setup move; the learner plays the rest.
 * This script does not write src/puzzles.data.ts.
 */
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Chess } from "chess.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, "../../..");
const ENGINE_DIR = join(REPO, "apps/web/public/engine");

/** Display order. Indexes in a row point into this list. Do not reorder. */
export const THEMES = [
  "mateIn1",
  "mateIn2",
  "fork",
  "pin",
  "skewer",
  "hangingPiece",
  "discoveredAttack",
  "backRankMate",
  "promotion",
  "endgame",
  "defensiveMove",
  "sacrifice",
];

const SCREEN_DEPTH = 8;
const VERIFY_DEPTH = 12;
const HIGH_DEPTH = 14;
const HIGH_GAP = 120;
const TOP_GAP = 100;
const HIGH_RATING = 1600;
const MAX_PLY = 64;
const MIN_PLY = 8;
/** Solver's best move must beat the second by at least this many centipawns. */
const MIN_GAP = 150;
/** Best move is "winning" at or above this (side to move). */
const WIN_CP = 150;
/** Second move is not itself a win at or below this. */
const SECOND_MAX = 50;
/** A save: best holds, second is losing by at least this. */
const SAVE_FLOOR = -50;
const LOSE_CP = -250;
/** Opponent reply counts as forced when it beats the alternative by this much. */
const REPLY_GAP = 80;

const VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
const SLIDE = {
  b: [[1, 1], [1, -1], [-1, 1], [-1, -1]],
  r: [[1, 0], [-1, 0], [0, 1], [0, -1]],
  q: [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]],
};

/** Short starting moves so games are not identical. Checked with chess.js at startup. */
const OPENINGS = [
  ["e2e4", "e7e5", "g1f3", "b8c6"],
  ["e2e4", "c7c5", "g1f3", "d7d6"],
  ["e2e4", "e7e6", "d2d4", "d7d5"],
  ["e2e4", "c7c6", "d2d4", "d7d5"],
  ["d2d4", "d7d5", "c2c4", "e7e6"],
  ["d2d4", "g8f6", "c2c4", "e7e6"],
  ["d2d4", "g8f6", "c2c4", "g7g6"],
  ["d2d4", "f7f5", "g1f3", "g8f6"],
  ["c2c4", "e7e5", "g1f3", "b8c6"],
  ["c2c4", "g8f6", "b1c3", "e7e5"],
  ["g1f3", "d7d5", "d2d4", "g8f6"],
  ["g1f3", "g8f6", "g2g3", "d7d5"],
  ["e2e4", "g8f6", "e4e5", "f6d5"],
  ["e2e4", "d7d5", "e4d5", "d8d5"],
  ["d2d4", "d7d6", "e2e4", "g8f6"],
  ["c2c4", "c7c5", "g1f3", "b8c6"],
  ["e2e4", "e7e5", "f2f4", "e5f4"],
  ["d2d4", "d7d5", "g1f3", "g8f6"],
  ["e2e4", "c7c5", "c2c3", "g8f6"],
  ["g1f3", "c7c5", "c2c4", "b8c6"],
];

const PRIMARY = ["mateIn1", "mateIn2", "backRankMate", "fork", "pin", "skewer", "discoveredAttack", "sacrifice", "promotion", "hangingPiece", "defensiveMove", "endgame"];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rand() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function fileOf(sq) {
  return sq.charCodeAt(0) - 97;
}
function rankOf(sq) {
  return sq.charCodeAt(1) - 49;
}
function square(f, r) {
  return "abcdefgh"[f] + "12345678"[r];
}

export function applyUci(chess, uci) {
  try {
    return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci.length > 4 ? uci[4] : undefined });
  } catch {
    return null;
  }
}

function placement(fen) {
  return fen.split(" ").slice(0, 4).join(" ");
}

function pieceCount(chess) {
  return chess.board().flat().filter(Boolean).length;
}

/** Queens gone and little material left, or a bare board. Matches the "endgame" tag the app already shows. */
function isEndgame(chess) {
  const pieces = chess.board().flat().filter(Boolean);
  if (pieces.length <= 14) return true;
  const queens = pieces.filter((p) => p.type === "q").length;
  return queens === 0 && pieces.length <= 20;
}

function material(chess, color) {
  let n = 0;
  for (const row of chess.board()) {
    for (const p of row) if (p && p.color === color && p.type !== "k") n += VAL[p.type];
  }
  return n;
}

/** Side-to-move centipawn value. Mates sort beyond any normal eval. */
export function scoreCp(entry) {
  if (!entry) return null;
  if (entry.mate != null) return entry.mate > 0 ? 10000 - entry.mate : -10000 - entry.mate;
  return entry.cp;
}

export function gapBetween(best, second) {
  if (!best) return 0;
  if (best.mate != null && best.mate > 0) {
    if (!second) return 800;
    if (second.mate != null && second.mate > 0) return 80 + (second.mate - best.mate) * 140;
    const alt = second.cp ?? 0;
    return 300 + Math.max(0, 180 - alt);
  }
  const b = scoreCp(best) ?? 0;
  const s = second ? scoreCp(second) ?? b - 300 : b - 800;
  return b - s;
}

export function scoreLabel(entry) {
  if (!entry) return null;
  if (entry.mate != null) return `mate ${entry.mate}`;
  return `cp ${entry.cp}`;
}

/** "win" when the best move is the only one that wins; "save" when it is the only one that holds. */
export function uniqueTactic(best, second, minGap = MIN_GAP) {
  if (!best?.move) return null;
  const gap = gapBetween(best, second);
  if (best.mate != null && best.mate > 0) {
    const slowerMate = second?.mate != null && second.mate > best.mate;
    const secondQuiet = !second || (second.mate == null && (second.cp ?? 0) <= SECOND_MAX) || (second.mate != null && second.mate <= 0);
    if ((slowerMate || secondQuiet) && gap >= minGap) return "win";
    return null;
  }
  const b = best.cp ?? 0;
  const s = second ? (second.cp ?? -10000) : b - 800;
  if (b >= Math.min(WIN_CP, minGap) && s <= SECOND_MAX && b - s >= minGap) return "win";
  if (b - s >= 250 && s < 40 && b >= 100) return "win";
  const secondLoses = Boolean(second) && (second.mate != null ? second.mate < 0 : second.cp <= LOSE_CP);
  if (b >= SAVE_FLOOR && secondLoses && b - s >= minGap) return "save";
  return null;
}

export function replyForced(best, second, legalCount, minGap = REPLY_GAP) {
  if (!best?.move) return false;
  if (legalCount <= 1) return true;
  if (!second) return false;
  if (best.mate != null && best.mate < 0 && second.mate != null && second.mate < 0) return second.mate !== best.mate;
  return gapBetween(best, second) >= minGap;
}

function onBoard(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8;
}

/** Pins and skewers from `color`'s sliders. Sets hold the front piece's square. */
function walkMotifs(chess, color) {
  const pins = new Set();
  const skewers = new Set();
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const piece = chess.get(square(f, r));
      if (!piece || piece.color !== color || !SLIDE[piece.type]) continue;
      for (const [df, dr] of SLIDE[piece.type]) {
        let nf = f + df;
        let nr = r + dr;
        let front = null;
        let frontSq = null;
        while (onBoard(nf, nr)) {
          const sq = square(nf, nr);
          const occ = chess.get(sq);
          if (!occ) {
            nf += df;
            nr += dr;
            continue;
          }
          if (!front) {
            if (occ.color === color) break;
            front = occ;
            frontSq = sq;
            nf += df;
            nr += dr;
            continue;
          }
          if (occ.color !== color) {
            const frontVal = VAL[front.type];
            const backVal = VAL[occ.type];
            if (front.type !== "k" && (occ.type === "k" || backVal > frontVal)) pins.add(frontSq);
            if (occ.type !== "k" && backVal >= 1 && (front.type === "k" || frontVal > backVal)) skewers.add(frontSq);
          }
          break;
        }
      }
    }
  }
  return { pins, skewers };
}

function sliderHits(chess, color) {
  const hits = [];
  for (let f = 0; f < 8; f++) {
    for (let r = 0; r < 8; r++) {
      const from = square(f, r);
      const piece = chess.get(from);
      if (!piece || piece.color !== color || !SLIDE[piece.type]) continue;
      for (const [df, dr] of SLIDE[piece.type]) {
        let nf = f + df;
        let nr = r + dr;
        while (onBoard(nf, nr)) {
          const sq = square(nf, nr);
          const occ = chess.get(sq);
          if (occ) {
            if (occ.color !== color) hits.push(`${from}>${sq}`);
            break;
          }
          nf += df;
          nr += dr;
        }
      }
    }
  }
  return hits;
}

function attacksSquare(piece, from, to, chess) {
  const df = fileOf(to) - fileOf(from);
  const dr = rankOf(to) - rankOf(from);
  const adf = Math.abs(df);
  const adr = Math.abs(dr);
  if (piece.type === "n") return (adf === 1 && adr === 2) || (adf === 2 && adr === 1);
  if (piece.type === "k") return adf <= 1 && adr <= 1 && adf + adr > 0;
  if (piece.type === "p") {
    const dir = piece.color === "w" ? 1 : -1;
    return adf === 1 && dr === dir;
  }
  if (!SLIDE[piece.type]) return false;
  const stepF = Math.sign(df);
  const stepR = Math.sign(dr);
  const diagonal = adf === adr && adf > 0;
  const straight = (adf === 0) !== (adr === 0);
  const ok = piece.type === "q" ? diagonal || straight : piece.type === "b" ? diagonal : straight;
  if (!ok) return false;
  for (let f = fileOf(from) + stepF, r = rankOf(from) + stepR; f !== fileOf(to) || r !== rankOf(to); f += stepF, r += stepR) {
    if (chess.get(square(f, r))) return false;
  }
  return true;
}

function forkTargets(chess, from) {
  const piece = chess.get(from);
  if (!piece) return [];
  const enemy = piece.color === "w" ? "b" : "w";
  const targets = [];
  for (const row of chess.board()) {
    for (const p of row) {
      if (!p || p.color !== enemy) continue;
      if (p.type !== "k" && VAL[p.type] < 3) continue;
      if (attacksSquare(piece, from, p.square, chess)) targets.push(p);
    }
  }
  return targets;
}

function added(after, before) {
  const out = [];
  for (const x of after) if (!before.has(x)) out.push(x);
  return out;
}

/**
 * Themes for one puzzle. `fen` is the position before the opponent setup move.
 * `moves` includes that setup move, then the solution, and ends on the learner.
 */
export function tagThemes(fen, moves) {
  const chess = new Chess(fen);
  if (!applyUci(chess, moves[0])) throw new Error(`illegal setup ${moves[0]}`);
  const solver = chess.turn();
  const themes = new Set();
  if (isEndgame(chess)) themes.add("endgame");
  const startMaterial = material(chess, solver);
  let solverPlies = 0;
  let mate = false;
  for (let i = 1; i < moves.length; i++) {
    const uci = moves[i];
    const learner = chess.turn() === solver;
    if (!learner) {
      if (!applyUci(chess, uci)) throw new Error(`illegal reply ${uci}`);
      if (material(chess, solver) <= startMaterial - 2) themes.add("sacrifice");
      continue;
    }
    const before = new Chess(chess.fen());
    const from = uci.slice(0, 2);
    const to = uci.slice(2, 4);
    const moving = before.get(from);
    const captured = before.get(to);
    const enemy = solver === "w" ? "b" : "w";
    const pinsBefore = walkMotifs(before, solver);
    const hitsBefore = new Set(sliderHits(before, solver));
    const played = applyUci(chess, uci);
    if (!played || !moving) throw new Error(`illegal solver move ${uci}`);
    if (uci.length > 4) themes.add("promotion");
    if (captured && before.attackers(to, enemy).length === 0) themes.add("hangingPiece");
    const gained = captured ? VAL[captured.type] : 0;
    const landed = chess.get(to);
    if (landed && landed.color === solver) {
      const lesser = chess.attackers(to, enemy).some((sq) => VAL[chess.get(sq).type] < VAL[landed.type]);
      if (lesser && VAL[landed.type] - gained >= 2) themes.add("sacrifice");
    }
    const pinsAfter = walkMotifs(chess, solver);
    if (added(pinsAfter.pins, pinsBefore.pins).length) themes.add("pin");
    if (added(pinsAfter.skewers, pinsBefore.skewers).length) themes.add("skewer");
    const hitsAfter = sliderHits(chess, solver);
    if (hitsAfter.some((h) => !h.startsWith(`${to}>`) && !hitsBefore.has(h))) themes.add("discoveredAttack");
    const forks = forkTargets(chess, to);
    const loose = forks.filter((p) => p.type === "k" || chess.attackers(p.square, enemy).length === 0);
    if (forks.length >= 2 && (moving.type === "n" || moving.type === "p" || loose.length >= 1)) themes.add("fork");
    solverPlies++;
    if (chess.isCheckmate()) {
      mate = true;
      const king = chess.board().flat().find((p) => p && p.type === "k" && p.color !== solver);
      const rank = king ? rankOf(king.square) : -1;
      if ((rank === 0 || rank === 7) && (moving.type === "r" || moving.type === "q" || landed?.type === "q" || landed?.type === "r")) themes.add("backRankMate");
      break;
    }
  }
  if (mate && solverPlies === 1) themes.add("mateIn1");
  if (mate && solverPlies === 2) themes.add("mateIn2");
  return THEMES.filter((t) => themes.has(t));
}

/**
 * Map engine features onto the pack's 400–1999 band.
 * Large gaps and checks score lower (easier). Extra plies and quiet moves score higher.
 */
export function ratePuzzle({ solverPlies, mate, gapCp, quietKey, keyIsCheck, pieceCount: pieces, themes }) {
  // Stand-in for the old pack's 400–1999 band, not player Glicko.
  // Big gaps and checks are easier. Extra plies and quiet moves are harder.
  const gap = Math.max(80, Math.min(950, gapCp));
  let rating = 1520 - Math.round(gap * 1.1);
  rating += (solverPlies - 1) * 280;
  if (mate && solverPlies === 1) rating -= 220;
  if (mate && solverPlies === 2) rating -= 40;
  if (quietKey) rating += 220;
  else if (keyIsCheck) rating -= 70;
  if (pieces >= 24) rating += 40;
  if (pieces <= 12) rating -= 70;
  if (themes.includes("defensiveMove") && !mate) rating += 20;
  if (themes.includes("sacrifice") && quietKey) rating += 70;
  return Math.max(400, Math.min(1999, rating));
}

export function primaryTheme(themes) {
  return PRIMARY.find((t) => themes.includes(t)) ?? "none";
}

/** Drop a later, shorter fragment of a combination already kept from the same game. */
export function dedupeLineage(pool) {
  const drop = new Set();
  for (let i = 0; i < pool.length; i++) {
    const a = pool[i];
    if (!a.origin) continue;
    for (let j = 0; j < pool.length; j++) {
      if (i === j) continue;
      const b = pool[j];
      if (!b.origin || a.origin.game !== b.origin.game) continue;
      if (Math.abs(a.origin.ply - b.origin.ply) > 4) continue;
      const earlier = b.origin.ply < a.origin.ply || (b.origin.ply === a.origin.ply && j < i);
      if (earlier && b.solverPlies >= a.solverPlies) drop.add(i);
    }
  }
  return pool.filter((_, i) => !drop.has(i));
}

/**
 * Greedy, stable pick. Spreads rating bands and primary themes.
 * `caps` limits a primary theme; leftovers fill any shortfall, earliest first on a tie.
 */
export function selectPuzzles(pool, count, caps = {}) {
  const picked = [];
  const used = new Set();
  const themeCount = {};
  const scoreOf = (i, enforceCap) => {
    if (used.has(i)) return null;
    const theme = primaryTheme(pool[i].themes);
    if (enforceCap && caps[theme] != null && (themeCount[theme] ?? 0) >= caps[theme]) return null;
    const bands = {};
    for (const p of picked) {
      const b = Math.floor(p.rating / 200);
      bands[b] = (bands[b] ?? 0) + 1;
    }
    return (bands[Math.floor(pool[i].rating / 200)] ?? 0) * 8 + (themeCount[theme] ?? 0) * 2 + (pool[i].themes.length ? 0 : 5);
  };
  while (picked.length < count && used.size < pool.length) {
    let best = -1;
    let bestScore = Infinity;
    for (const enforceCap of [true, false]) {
      for (let i = 0; i < pool.length; i++) {
        const score = scoreOf(i, enforceCap);
        if (score == null || score >= bestScore) continue;
        bestScore = score;
        best = i;
      }
      if (best >= 0) break;
    }
    if (best < 0) break;
    used.add(best);
    picked.push(pool[best]);
    const theme = primaryTheme(pool[best].themes);
    themeCount[theme] = (themeCount[theme] ?? 0) + 1;
  }
  return picked;
}

function parseSearch(lines, depth) {
  const byPv = new Map();
  let sawDepth = 0;
  for (const line of lines) {
    if (!line.startsWith("info ") || !line.includes(" score ") || !line.includes(" pv ")) continue;
    const d = Number(line.match(/\bdepth (\d+)/)?.[1] ?? 0);
    sawDepth = Math.max(sawDepth, d);
    if (d !== depth) continue;
    const pvN = Number(line.match(/\bmultipv (\d+)/)?.[1] ?? 1);
    const mate = line.match(/\bscore mate (-?\d+)/);
    const cp = line.match(/\bscore cp (-?\d+)/);
    const pv = line.split(" pv ")[1].trim().split(/\s+/);
    byPv.set(pvN, { mate: mate ? Number(mate[1]) : null, cp: mate ? null : Number(cp?.[1]), move: pv[0], pv });
  }
  return { pvs: [...byPv.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => v), sawDepth };
}

class Engine {
  constructor(mod) {
    this.mod = mod;
    this.lines = [];
    this.waiter = null;
    this.multipv = 1;
  }
  static async open() {
    const require = createRequire(import.meta.url);
    const Stockfish = require(join(ENGINE_DIR, "stockfish-18-lite-single.js"));
    const engine = new Engine(null);
    const mod = await Stockfish()({
      locateFile: (file) => join(ENGINE_DIR, file.includes(".wasm") ? "stockfish-18-lite-single.wasm" : file),
      listener: (chunk) => {
        for (const raw of String(chunk).split("\n")) {
          const line = raw.trim();
          if (line) engine.lines.push(line);
        }
        engine.flush();
      },
    });
    engine.mod = mod;
    await engine.expect("uci", "uciok");
    engine.raw("setoption name Threads value 1");
    engine.raw("setoption name Hash value 32");
    engine.raw("ucinewgame");
    return engine;
  }
  raw(cmd) {
    this.mod.ccall("command", null, ["string"], [cmd], { async: false });
  }
  flush() {
    if (!this.waiter) return;
    const token = this.waiter.token;
    if (this.lines.some((l) => l === token || l.startsWith(`${token} `) || l.startsWith(token))) {
      const w = this.waiter;
      this.waiter = null;
      clearTimeout(w.timer);
      w.resolve(this.lines.slice());
    }
  }
  expect(cmd, token) {
    this.lines = [];
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = null;
        reject(new Error(`Stockfish timed out on "${cmd}"\n${this.lines.slice(-4).join("\n")}`));
      }, 60000);
      this.waiter = { token, timer, resolve };
      this.raw(cmd);
      this.flush();
    });
  }
  async search(fen, depth, multipv) {
    if (this.multipv !== multipv) {
      this.raw(`setoption name MultiPV value ${multipv}`);
      this.multipv = multipv;
    }
    this.raw("setoption name Clear Hash value true");
    this.raw(`position fen ${fen}`);
    const lines = await this.expect(`go depth ${depth}`, "bestmove");
    const parsed = parseSearch(lines, depth);
    if (parsed.sawDepth < depth || !parsed.pvs.length) return [];
    return parsed.pvs;
  }
}

function openingOrThrow(moves) {
  const chess = new Chess();
  for (const uci of moves) {
    if (!applyUci(chess, uci)) throw new Error(`opening move ${uci} is illegal`);
  }
}

function choosePlayedMove(pvs, turn, erring, rate, rand, ply, calmUntil, tactical) {
  const best = pvs[0]?.move;
  if (!best || turn !== erring || ply < calmUntil) return best ?? null;
  const [lo, hi] = tactical ? [120, 420] : [80, 220];
  const alts = [pvs[2], pvs[1]].filter(Boolean);
  for (const alt of alts) {
    const gap = gapBetween(pvs[0], alt);
    if (gap < lo) continue;
    if (gap <= hi && rand() < rate) return alt.move;
    // A large gap is a blunder that hangs a mate or a piece. Tactical games play some of those.
    if (tactical && gap > hi && rand() < rate * 0.45) return alt.move;
  }
  return best;
}

async function verifyLine(engine, fenBefore, setupUci, minGap = MIN_GAP, replyGap = REPLY_GAP, highGap = HIGH_GAP, onlyHigh = false) {
  const chess = new Chess(fenBefore);
  if (!applyUci(chess, setupUci)) return null;
  if (chess.moves().length < 2) return null;
  const solver = chess.turn();
  const line = [setupUci];
  const detail = [];
  let solverPlies = 0;
  let kind = null;
  while (solverPlies < 3) {
    const pvs = await engine.search(chess.fen(), VERIFY_DEPTH, 2);
    const tactic = uniqueTactic(pvs[0], pvs[1], minGap);
    if (!tactic) {
      if (solverPlies === 0) return null;
      if (detail.at(-1)?.role === "opponent") {
        detail.pop();
        line.pop();
      }
      break;
    }
    if (solverPlies === 0) kind = tactic;
    const uci = pvs[0].move;
    detail.push({
      uci,
      role: "solver",
      best: scoreLabel(pvs[0]),
      second: scoreLabel(pvs[1]),
      gapCp: gapBetween(pvs[0], pvs[1]),
    });
    if (!applyUci(chess, uci)) return null;
    line.push(uci);
    solverPlies++;
    if (chess.isCheckmate() || chess.isGameOver() || solverPlies === 3) break;
    const legal = chess.moves().length;
    const reply = await engine.search(chess.fen(), VERIFY_DEPTH, 2);
    if (!reply[0]?.move) return null;
    if (!replyForced(reply[0], reply[1], legal, replyGap)) break;
    detail.push({
      uci: reply[0].move,
      role: "opponent",
      best: scoreLabel(reply[0]),
      second: scoreLabel(reply[1]),
      gapCp: gapBetween(reply[0], reply[1]),
      forced: true,
    });
    if (!applyUci(chess, reply[0].move)) return null;
    line.push(reply[0].move);
  }
  if (solverPlies < 1 || line.length % 2 !== 0) return null;
  const afterSetup = new Chess(fenBefore);
  applyUci(afterSetup, setupUci);
  const keyUci = line[1];
  const moving = afterSetup.get(keyUci.slice(0, 2));
  const captured = afterSetup.get(keyUci.slice(2, 4));
  const preview = new Chess(afterSetup.fen());
  applyUci(preview, keyUci);
  const quietKey = Boolean(moving) && !captured && !preview.isCheck();
  const keyIsCheck = preview.isCheck();
  const themes = tagThemes(fenBefore, line);
  // A save that is not just "take the loose piece" is a defensive puzzle. Checks that win are not.
  if (kind === "save" && !themes.includes("hangingPiece")) themes.push("defensiveMove");
  const ordered = THEMES.filter((t) => themes.includes(t));
  if (!ordered.length) return null;
  const solverDetail = detail.filter((p) => p.role === "solver");
  const gapCp = solverDetail[0].gapCp;
  const minSolverGapCp = Math.min(...solverDetail.map((p) => p.gapCp));
  if (minSolverGapCp < minGap) return null;
  const mate = endsInMate(fenBefore, line);
  const pieceCountAfter = pieceCount(afterSetup);
  let rating = ratePuzzle({ solverPlies, mate, gapCp, quietKey, keyIsCheck, pieceCount: pieceCountAfter, themes: ordered });
  const puzzle = {
    fen: fenBefore,
    moves: line.join(" "),
    rating,
    themes: ordered,
    themeIndexes: ordered.map((t) => THEMES.indexOf(t)),
    gapCp,
    minSolverGapCp,
    verifyDepth: VERIFY_DEPTH,
    solverPlies,
    mate,
    quietKey,
    keyIsCheck,
    pieceCount: pieceCountAfter,
    kind,
  };
  if (rating < HIGH_RATING) return onlyHigh || minSolverGapCp < MIN_GAP ? null : puzzle;
  return deepenHigh(engine, puzzle, highGap, onlyHigh);
}

/** 1600–1999 must still be unique at depth 14. `highGap` is 120, or 100 for the top shard. */
async function deepenHigh(engine, puzzle, highGap = HIGH_GAP, strict = false) {
  const moves = puzzle.moves.split(" ");
  const chess = new Chess(puzzle.fen);
  if (!applyUci(chess, moves[0])) return null;
  const solver = chess.turn();
  let firstGap = null;
  let minGap = Infinity;
  for (let i = 1; i < moves.length; i++) {
    if (chess.turn() === solver) {
      const pvs = await engine.search(chess.fen(), HIGH_DEPTH, 2);
      if (pvs[0]?.move !== moves[i]) return strict || puzzle.minSolverGapCp < MIN_GAP ? null : { ...puzzle, rating: Math.min(puzzle.rating, 1599) };
      const gap = gapBetween(pvs[0], pvs[1]);
      if (!uniqueTactic(pvs[0], pvs[1], highGap) || gap < highGap) {
        return strict || puzzle.minSolverGapCp < MIN_GAP ? null : { ...puzzle, rating: Math.min(puzzle.rating, 1599) };
      }
      if (firstGap == null) firstGap = gap;
      minGap = Math.min(minGap, gap);
    }
    if (!applyUci(chess, moves[i])) return null;
  }
  const rating = ratePuzzle({
    solverPlies: puzzle.solverPlies,
    mate: puzzle.mate,
    gapCp: firstGap,
    quietKey: puzzle.quietKey,
    keyIsCheck: puzzle.keyIsCheck,
    pieceCount: puzzle.pieceCount,
    themes: puzzle.themes,
  });
  const next = { ...puzzle, gapCp: firstGap, minSolverGapCp: minGap, rating, verifyDepth: HIGH_DEPTH };
  if (rating >= HIGH_RATING && minGap >= highGap) return next;
  if (strict) return null;
  if (minGap >= MIN_GAP) return next;
  return null;
}

function endsInMate(fen, line) {
  const chess = new Chess(fen);
  for (const uci of line) if (!applyUci(chess, uci)) return false;
  return chess.isCheckmate();
}

export function summarize(puzzles) {
  const buckets = {};
  const themes = Object.fromEntries(THEMES.map((t) => [t, 0]));
  const lengths = {};
  let untagged = 0;
  for (const p of puzzles) {
    const b = Math.floor(p.rating / 100) * 100;
    buckets[b] = (buckets[b] ?? 0) + 1;
    if (!p.themes.length) untagged++;
    for (const t of new Set(p.themes)) themes[t]++;
    const n = String(p.moves).split(" ").length;
    lengths[n] = (lengths[n] ?? 0) + 1;
  }
  return { count: puzzles.length, buckets, themes, untagged, lengths };
}

function assertSane(puzzle) {
  const chess = new Chess(puzzle.fen);
  for (const uci of puzzle.moves.split(" ")) {
    if (!applyUci(chess, uci)) throw new Error(`${puzzle.id} illegal ${uci}`);
  }
  if (puzzle.rating < 400 || puzzle.rating > 1999) throw new Error(`${puzzle.id} rating ${puzzle.rating}`);
  if (puzzle.moves.split(" ").length % 2) throw new Error(`${puzzle.id} line does not end on the learner`);
  const blob = JSON.stringify(puzzle).toLowerCase();
  if (blob.includes("://")) throw new Error(`${puzzle.id} carries a link`);
  if (puzzle.themeIndexes.some((n, i) => THEMES[n] !== puzzle.themes[i])) throw new Error(`${puzzle.id} theme index mismatch`);
}

function profileFor(mode, gameIndex) {
  if (mode === "tactical") return { tactical: true, rate: 0.62, calmUntil: 4, screenGap: MIN_GAP, verifyGap: MIN_GAP, fast: false, keep: "all", replyGap: REPLY_GAP };
  if (mode === "endgame") return { tactical: false, rate: 0.22, calmUntil: 0, screenGap: MIN_GAP, verifyGap: MIN_GAP, fast: true, keep: "all", replyGap: REPLY_GAP };
  if (mode === "quiet") return { tactical: false, rate: 0.1, calmUntil: 8, screenGap: HIGH_GAP, verifyGap: HIGH_GAP, fast: false, keep: "all", replyGap: REPLY_GAP };
  if (mode === "high") return { tactical: false, rate: 0.2, calmUntil: 6, screenGap: HIGH_GAP, verifyGap: HIGH_GAP, fast: false, keep: "high", replyGap: 30, highGap: HIGH_GAP, onlyHigh: false };
  if (mode === "top") return { tactical: false, rate: 0.22, calmUntil: 4, screenGap: TOP_GAP, verifyGap: TOP_GAP, fast: false, keep: "top", replyGap: 25, highGap: TOP_GAP, onlyHigh: true };
  if (mode === "promo") return { tactical: true, rate: 0.35, calmUntil: 12, screenGap: MIN_GAP, verifyGap: MIN_GAP, fast: false, keep: "promo", replyGap: REPLY_GAP };
  const tactical = gameIndex % 2 === 1;
  return { tactical, rate: tactical ? 0.42 : 0.12, calmUntil: tactical ? 8 : 28, screenGap: tactical ? MIN_GAP : HIGH_GAP, verifyGap: tactical ? MIN_GAP : HIGH_GAP, fast: false, keep: "all", replyGap: REPLY_GAP };
}

/** Play accurate shallow moves until the board is an endgame, so mining starts there. */
async function fastForward(engine, chess) {
  let prev = null;
  let ply = 0;
  while (!chess.isGameOver() && pieceCount(chess) > 12 && ply < 72) {
    const fen = chess.fen();
    const pvs = await engine.search(fen, 5, 1);
    const move = pvs[0]?.move;
    if (!move || !applyUci(chess, move)) break;
    prev = { fenBefore: fen, uci: move, ply: ply + 1 };
    ply++;
  }
  return { prev, ply };
}

async function generate(opts) {
  for (const opening of OPENINGS) openingOrThrow(opening);
  const rand = mulberry32(opts.seed);
  const engine = await Engine.open();
  const pool = [];
  const seen = new Set();
  const stats = { screened: 0, candidates: 0, kept: 0 };
  const t0 = Date.now();
  const mode = opts.mode || "mixed";
  for (let g = 0; g < opts.games && pool.length < opts.pool; g++) {
    const opening = OPENINGS[(g + opts.seed) % OPENINGS.length];
    const chess = new Chess();
    for (const uci of opening) applyUci(chess, uci);
    const erring = g % 2 === 0 ? "w" : "b";
    const profile = profileFor(mode, g);
    let prev = null;
    let ply = opening.length;
    if (profile.fast) {
      const jumped = await fastForward(engine, chess);
      prev = jumped.prev;
      ply = Math.max(ply, jumped.ply);
    }
    const maxPly = profile.fast ? ply + 40 : MAX_PLY;
    for (; ply < maxPly && !chess.isGameOver(); ply++) {
      const fen = chess.fen();
      const pvs = await engine.search(fen, SCREEN_DEPTH, profile.fast ? 2 : 3);
      stats.screened++;
      const gap = gapBetween(pvs[0], pvs[1]);
      const moveUci = pvs[0]?.move ?? "";
      const mover = moveUci ? chess.get(moveUci.slice(0, 2)) : null;
      const captured = moveUci ? chess.get(moveUci.slice(2, 4)) : null;
      const pawnPush = mover?.type === "p" && ("18".includes(moveUci[3]) || moveUci.length > 4);
      const advancedPawn = chess.board().flat().some((p) => p?.type === "p" && ((p.color === "w" && p.square[1] >= "6") || (p.color === "b" && p.square[1] <= "3")));
      const worthVerifying = (profile.keep !== "high" && profile.keep !== "top") || !captured || gap <= 280 || Boolean(pvs[0]?.mate > 0) || (pvs[0]?.pv?.length ?? 0) >= 4;
      const promoHit = profile.keep !== "promo" || pawnPush || advancedPawn || (pvs[0]?.pv ?? []).some((u) => u.length > 4);
      const candidate = prev && ply >= MIN_PLY && worthVerifying && promoHit && (uniqueTactic(pvs[0], pvs[1], profile.screenGap) || (pvs[0]?.mate > 0 && uniqueTactic(pvs[0], pvs[1], HIGH_GAP)));
      if (candidate) {
        const key = `${placement(fen)} ${pvs[0].move}`;
        if (!seen.has(key)) {
          seen.add(key);
          stats.candidates++;
          const puzzle = await verifyLine(engine, prev.fenBefore, prev.uci, profile.verifyGap, profile.replyGap, profile.highGap ?? HIGH_GAP, Boolean(profile.onlyHigh));
          const keepHigh = profile.keep === "top"
            ? puzzle && puzzle.rating >= HIGH_RATING && puzzle.verifyDepth === HIGH_DEPTH && puzzle.minSolverGapCp >= TOP_GAP
            : profile.keep !== "high" || (puzzle && (puzzle.rating >= 1450 || puzzle.quietKey || puzzle.solverPlies >= 2 || puzzle.gapCp <= 240));
          if (puzzle && keepHigh) {
            puzzle.origin = { seed: opts.seed, mode, game: g + 1, ply: prev.ply, erring };
            pool.push(puzzle);
            stats.kept++;
          }
        }
      }
      const move = choosePlayedMove(pvs, chess.turn(), erring, profile.rate, rand, ply, profile.calmUntil, profile.tactical);
      if (!move || !applyUci(chess, move)) break;
      prev = { fenBefore: fen, uci: move, ply: ply + 1 };
      if (pool.length >= opts.pool) break;
    }
    if ((g + 1) % 5 === 0 || g === 0) {
      process.stderr.write(`${mode} seed ${opts.seed} game ${g + 1}/${opts.games} pool ${pool.length} (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
    }
  }
  opts._seconds = (Date.now() - t0) / 1000;
  if (opts.raw) {
    return {
      seed: opts.seed,
      mode,
      seconds: opts._seconds,
      screenDepth: SCREEN_DEPTH,
      verifyDepth: VERIFY_DEPTH,
      highDepth: HIGH_DEPTH,
      highGap: HIGH_GAP,
      distribution: summarize(pool),
      puzzles: pool,
    };
  }
  const diverse = dedupeLineage(pool);
  const selected = selectPuzzles(diverse, opts.count, {
    hangingPiece: Math.max(2, Math.round(opts.count * 0.2)),
    defensiveMove: Math.max(2, Math.round(opts.count * 0.15)),
    none: Math.max(1, Math.round(opts.count * 0.1)),
  }).map((p, i) => {
    const id = `csp-${String(i + 1).padStart(4, "0")}`;
    const row = [id, p.fen, p.moves, p.rating, p.themeIndexes];
    return { id, ...p, row };
  });
  for (const p of selected) assertSane(p);
  return {
    seed: opts.seed,
    engine: "Stockfish 18 Lite WASM (apps/web/public/engine/stockfish-18-lite-single.js)",
    network: "nn-9067e33176e8.nnue",
    screenDepth: SCREEN_DEPTH,
    verifyDepth: VERIFY_DEPTH,
    gamesRequested: opts.games,
    poolSize: pool.length,
    diverseSize: diverse.length,
    thresholds: { MIN_GAP, WIN_CP, SECOND_MAX, SAVE_FLOOR, LOSE_CP, REPLY_GAP },
    distribution: summarize(selected),
    poolDistribution: summarize(pool),
    puzzles: selected,
  };
}

const BUCKETS = Array.from({ length: 16 }, (_, i) => 400 + i * 100);

/** Pick a pack near `target` with a floor in every rating bucket and every theme. Defence stays at or under 20%. */
export function selectFullPack(puzzles, opts = {}) {
  const target = opts.target ?? 1500;
  const bucketFloor = opts.bucketFloor ?? 40;
  const themeFloor = opts.themeFloor ?? 20;
  const defensiveMax = opts.defensiveMax ?? 0.2;
  const seen = new Set();
  const pool = [];
  for (const raw of puzzles) {
    if (!raw?.themes?.length || raw.rating == null || !raw.fen || !raw.moves) continue;
    const moves = String(raw.moves).split(" ");
    if (moves.length < 2 || moves.length % 2) continue;
    let board;
    try {
      board = new Chess(raw.fen);
    } catch {
      continue;
    }
    if (!applyUci(board, moves[0]) || board.moves().length < 2) continue;
    const answer = moves[1];
    const legal = board.moves({ verbose: true }).some((m) => `${m.from}${m.to}` === answer.slice(0, 4));
    if (!legal) continue;
    const key = `${placement(board.fen())} ${answer}`;
    if (seen.has(key)) continue;
    const bucket = Math.floor(raw.rating / 100) * 100;
    if (!BUCKETS.includes(bucket)) continue;
    const gap = raw.minSolverGapCp ?? raw.gapCp ?? 0;
    const depth = raw.verifyDepth ?? VERIFY_DEPTH;
    if (bucket >= HIGH_RATING) {
      if (depth < HIGH_DEPTH || gap < TOP_GAP) continue;
    } else if (gap < MIN_GAP) continue;
    seen.add(key);
    pool.push(raw);
  }
  pool.sort((a, b) => (a.origin?.seed ?? 0) - (b.origin?.seed ?? 0) || (a.origin?.game ?? 0) - (b.origin?.game ?? 0) || (a.origin?.ply ?? 0) - (b.origin?.ply ?? 0) || a.fen.localeCompare(b.fen));

  const picked = [];
  const used = new Set();
  const bCount = Object.fromEntries(BUCKETS.map((b) => [b, 0]));
  const tCount = Object.fromEntries(THEMES.map((t) => [t, 0]));
  let defensive = 0;
  const add = (i) => {
    if (used.has(i)) return;
    used.add(i);
    const p = pool[i];
    picked.push(p);
    bCount[Math.floor(p.rating / 100) * 100]++;
    for (const t of new Set(p.themes)) tCount[t]++;
    if (p.themes.includes("defensiveMove")) defensive++;
  };

  for (const theme of THEMES) {
    while (tCount[theme] < themeFloor) {
      let best = -1;
      let bestScore = Infinity;
      for (let i = 0; i < pool.length; i++) {
        if (used.has(i) || !pool[i].themes.includes(theme)) continue;
        const b = Math.floor(pool[i].rating / 100) * 100;
        const score = (bCount[b] ?? 0) * 10 + (pool[i].themes.includes("defensiveMove") ? 4 : 0);
        if (score < bestScore) {
          bestScore = score;
          best = i;
        }
      }
      if (best < 0) break;
      add(best);
    }
  }
  for (const b of BUCKETS) {
    while ((bCount[b] ?? 0) < bucketFloor) {
      const i = pool.findIndex((p, idx) => !used.has(idx) && Math.floor(p.rating / 100) * 100 === b);
      if (i < 0) break;
      add(i);
    }
  }
  let guard = 0;
  while (picked.length < target && used.size < pool.length && guard < pool.length * 3) {
    guard++;
    let progress = false;
    const order = [...BUCKETS].sort((a, c) => bCount[a] - bCount[c]);
    for (const b of order) {
      if (picked.length >= target) break;
      const i = pool.findIndex((p, idx) => !used.has(idx) && Math.floor(p.rating / 100) * 100 === b && !p.themes.includes("defensiveMove"));
      if (i < 0) continue;
      add(i);
      progress = true;
    }
    if (!progress) break;
  }

  const canDrop = (index, ignoreFloors) => {
    const p = picked[index];
    if (!p.themes.includes("defensiveMove")) return false;
    const b = Math.floor(p.rating / 100) * 100;
    if (!ignoreFloors && bCount[b] <= bucketFloor) return false;
    if (!ignoreFloors && p.themes.some((t) => tCount[t] <= themeFloor)) return false;
    return true;
  };
  const dropAt = (index) => {
    const p = picked.splice(index, 1)[0];
    bCount[Math.floor(p.rating / 100) * 100]--;
    for (const t of new Set(p.themes)) tCount[t]--;
    defensive--;
  };
  while (picked.length && defensive / picked.length > defensiveMax) {
    let index = -1;
    for (let i = picked.length - 1; i >= 0; i--) if (canDrop(i, false)) { index = i; break; }
    if (index < 0) {
      for (let i = picked.length - 1; i >= 0; i--) if (canDrop(i, true)) { index = i; break; }
    }
    if (index < 0) break;
    dropAt(index);
  }

  return {
    puzzles: picked,
    counts: { buckets: bCount, themes: tCount, defensive },
    short: {
      buckets: BUCKETS.filter((b) => bCount[b] < bucketFloor).map((b) => [b, bCount[b]]),
      themes: THEMES.filter((t) => tCount[t] < themeFloor).map((t) => [t, tCount[t]]),
      defensiveRatio: picked.length ? defensive / picked.length : 0,
      untagged: picked.filter((p) => !p.themes.length).length,
    },
  };
}

export const PACK_VERSION = "own-2026.11.13-s20261113";

export function publishPuzzle(p, index) {
  const themes = [...new Set(p.themes)].filter((t) => THEMES.includes(t));
  return {
    id: `csp-${String(index + 1).padStart(4, "0")}`,
    fen: p.fen,
    moves: Array.isArray(p.moves) ? p.moves : String(p.moves).split(" "),
    rating: p.rating,
    themes,
  };
}

/** About 100 puzzles, at least one in every rating bucket and every theme the lessons and the puzzle tab use. */
export function selectFallback(puzzles, target = 100) {
  const buckets = Array.from({ length: 16 }, (_, i) => 400 + i * 100);
  const byBucket = Object.fromEntries(buckets.map((b) => [b, []]));
  for (const p of puzzles) {
    const b = Math.floor(p.rating / 100) * 100;
    if (byBucket[b]) byBucket[b].push(p);
  }
  const picked = [];
  const used = new Set();
  const add = (p) => {
    if (!p || used.has(p.id)) return false;
    used.add(p.id);
    picked.push(p);
    return true;
  };
  for (const b of buckets) add(byBucket[b][0]);
  for (const theme of THEMES) {
    if (picked.some((p) => p.themes.includes(theme))) continue;
    add(puzzles.find((p) => p.themes.includes(theme)));
  }
  let guard = 0;
  while (picked.length < target && guard < puzzles.length) {
    guard++;
    let added = false;
    for (const b of [...buckets].sort((a, c) => byBucket[a].filter((p) => used.has(p.id)).length - byBucket[c].filter((p) => used.has(p.id)).length)) {
      if (picked.length >= target) break;
      const next = byBucket[b].find((p) => !used.has(p.id));
      if (add(next)) added = true;
    }
    if (!added) break;
  }
  return picked;
}

export function renderPack(puzzles) {
  const rows = puzzles.map((p) => [p.id, p.fen, p.moves.join(" "), p.rating, p.themes.map((t) => THEMES.indexOf(t))]);
  return (
    `/** Generated by scripts/generate-own-puzzles.mjs from Stockfish self-play. Do not edit. */\n` +
    `export const PUZZLE_THEME_TAGS = ${JSON.stringify(THEMES)} as const;\n` +
    `/** [id, fen, uci moves, rating, theme indexes] */\n` +
    `export const PUZZLE_ROWS: [string, string, string, number, number[]][] = ${JSON.stringify(rows)};\n`
  );
}

export function packDocument(puzzles, version = PACK_VERSION) {
  return { version, puzzles };
}

function writeStats(path, { version, published, fallback, selected, shards, summary }) {
  const bucketRows = Array.from({ length: 16 }, (_, i) => 400 + i * 100)
    .map((b) => `| ${b}–${b + 99} | ${summary.buckets[b] ?? 0} |`)
    .join("\n");
  const themeRows = THEMES.map((t) => `| ${t} | ${summary.themes[t] ?? 0} |`).join("\n");
  const seedRows = shards
    .map((s) => `| ${s.json.mode ?? ""} | ${s.json.seed ?? ""} | ${s.json.puzzles?.length ?? 0} | ${Math.round(s.json.seconds ?? 0)}s |`)
    .join("\n");
  const fb = summarize(fallback);
  const fbBuckets = Array.from({ length: 16 }, (_, i) => 400 + i * 100)
    .map((b) => `| ${b} | ${fb.buckets[b] ?? 0} |`)
    .join("\n");
  const text = `# Own puzzle pack\n\nVersion \`${version}\`.\n\n## Settings\n\n- Screen depth 8. Verify depth 12 with a 150 centipawn gap for ratings under 1600.\n- Ratings 1600–1999 are confirmed at depth 14. The top shards use a 100 centipawn gap; earlier high shards used 120. The pack accepts either, as long as the gap is at least 100.\n- One Stockfish thread, hash cleared before every search. No movetime.\n- Defence is capped at 20% of the pack. Every puzzle has at least one theme.\n\n## Shards\n\n| Mode | Seed | Kept | Runtime |\n|---|---:|---:|---:|\n${seedRows}\n\n## Pack\n\n${published.length} puzzles. ${fallback.length} in the offline fallback.\n\n| Bucket | Count |\n|---|---:|\n${bucketRows}\n\n| Theme | Count |\n|---|---:|\n${themeRows}\n\nUntagged: ${summary.untagged}. Defence: ${selected.counts.defensive} (${published.length ? ((selected.counts.defensive / published.length) * 100).toFixed(1) : 0}%).\n\nFloor of 40 per bucket, still short: ${selected.short.buckets.map(([b, n]) => `${b}:${n}`).join(", ") || "none"}.\n\nFloor of 20 per theme, still short: ${selected.short.themes.map(([t, n]) => `${t}:${n}`).join(", ") || "none"}.\n\n1600–1999 reduced floor of 20: ${[1600, 1700, 1800, 1900].map((b) => `${b}:${summary.buckets[b] ?? 0}`).join(", ")}. Any of those under 20 is a gap.\n\n\n## Fallback coverage\n\n| Bucket | Count |\n|---|---:|\n${fbBuckets}\n\n| Theme | Count |\n|---|---:|\n${THEMES.map((t) => `| ${t} | ${fb.themes[t] ?? 0} |`).join("\n")}\n`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, text);
}

export function checkThemes() {
  const cases = [
    {
      name: "back rank mate",
      fen: "6k1/1p3ppp/8/8/8/8/6K1/R7 b - - 0 1",
      moves: ["b7b6", "a1a8"],
      has: ["mateIn1", "backRankMate"],
    },
    {
      name: "pin",
      fen: "4k3/p3n3/8/8/8/8/R7/4K3 b - - 0 1",
      moves: ["a7a6", "a2e2"],
      has: ["pin"],
    },
    {
      name: "knight fork",
      fen: "k3r3/7p/8/3N4/8/8/8/7K b - - 0 1",
      moves: ["h7h6", "d5c7"],
      has: ["fork"],
    },
    {
      name: "hanging knight",
      fen: "4k3/8/8/n7/8/2B5/8/4K3 b - - 0 1",
      moves: ["e8f8", "c3a5"],
      has: ["hangingPiece"],
    },
    {
      name: "promotion",
      fen: "4k3/P7/8/8/8/8/8/4K3 b - - 0 1",
      moves: ["e8d8", "a7a8q"],
      has: ["promotion"],
    },
  ];
  for (const c of cases) {
    const tags = tagThemes(c.fen, c.moves);
    for (const t of c.has) {
      if (!tags.includes(t)) throw new Error(`${c.name} missing ${t} (got ${tags.join(",") || "none"})`);
    }
  }
  const easy = ratePuzzle({ solverPlies: 1, mate: true, gapCp: 800, quietKey: false, keyIsCheck: true, pieceCount: 18, themes: ["mateIn1"] });
  const hard = ratePuzzle({ solverPlies: 3, mate: false, gapCp: 160, quietKey: true, keyIsCheck: false, pieceCount: 28, themes: ["sacrifice"] });
  if (!(easy < hard)) throw new Error(`rating order ${easy} vs ${hard}`);
  if (easy < 400 || hard > 1999) throw new Error(`rating range ${easy} ${hard}`);
  const picked = selectPuzzles(
    [
      { rating: 500, themes: ["mateIn1"] },
      { rating: 520, themes: ["mateIn1"] },
      { rating: 1400, themes: ["fork"] },
      { rating: 1500, themes: ["pin"] },
    ],
    3,
  );
  if (picked.length !== 3) throw new Error("select size");
  if (primaryTheme(picked[0].themes) === primaryTheme(picked[1].themes) && primaryTheme(picked[1].themes) === primaryTheme(picked[2].themes)) {
    throw new Error("select did not spread themes");
  }
  for (const opening of OPENINGS) openingOrThrow(opening);
}

async function checkEngine() {
  const engine = await Engine.open();
  const pvs = await engine.search("6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1", VERIFY_DEPTH, 2);
  if (pvs[0]?.move !== "a1a8" || pvs[0]?.mate !== 1) throw new Error(`engine mate check failed: ${JSON.stringify(pvs[0])}`);
  if (!pvs[1] || gapBetween(pvs[0], pvs[1]) < MIN_GAP) throw new Error("engine did not report a second move and a gap");
}

function parseArgs(argv) {
  const opts = { count: 20, seed: 20261113, games: 48, pool: 140, out: "", mode: "mixed", raw: false, check: false, help: false, merge: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === "--check") opts.check = true;
    else if (a === "--help") opts.help = true;
    else if (a === "--raw") opts.raw = true;
    else if (a === "--count") opts.count = Number(next());
    else if (a === "--seed") opts.seed = Number(next());
    else if (a === "--games") opts.games = Number(next());
    else if (a === "--pool") opts.pool = Number(next());
    else if (a === "--out") opts.out = next();
    else if (a === "--mode") opts.mode = next();
    else if (a === "--pack") opts.pack = next();
    else if (a === "--stats") opts.stats = next();
    else if (a === "--json") opts.json = next();
    else if (a === "--fallback") opts.fallback = next();
    else if (a === "--version") opts.version = next();
    else if (a === "--merge") {
      while (argv[i + 1] && !argv[i + 1].startsWith("--")) opts.merge.push(argv[++i]);
    } else throw new Error(`unknown argument ${a}`);
  }
  return opts;
}

function readShard(path) {
  const json = JSON.parse(readFileSync(path, "utf8"));
  return json.puzzles ?? json;
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.help) {
    console.log("see the comment at the top of generate-own-puzzles.mjs");
    return;
  }
  if (opts.check) {
    checkThemes();
    await checkEngine();
    console.log("check ok");
    return;
  }
  if (opts.merge.length) {
    const shards = opts.merge.map((path) => ({ path, json: JSON.parse(readFileSync(path, "utf8")) }));
    const all = shards.flatMap((s) => s.json.puzzles ?? s.json);
    const selected = selectFullPack(all);
    const published = selected.puzzles.map((p, i) => publishPuzzle(p, i));
    const fallback = selectFallback(published);
    const version = opts.version || PACK_VERSION;
    if (!opts.pack) throw new Error("--pack is required with --merge");
    mkdirSync(dirname(resolve(opts.pack)), { recursive: true });
    writeFileSync(resolve(opts.pack), renderPack(published));
    if (opts.json) {
      mkdirSync(dirname(resolve(opts.json)), { recursive: true });
      writeFileSync(resolve(opts.json), `${JSON.stringify(packDocument(published, version))}\n`);
    }
    if (opts.fallback) {
      mkdirSync(dirname(resolve(opts.fallback)), { recursive: true });
      writeFileSync(resolve(opts.fallback), `${JSON.stringify(packDocument(fallback, version))}\n`);
    }
    const summary = summarize(published);
    console.log(JSON.stringify({ count: published.length, fallback: fallback.length, short: selected.short, version }));
    if (opts.stats) writeStats(resolve(opts.stats), { version, published, fallback, selected, shards, summary });
    return;
  }
  if (!opts.out) throw new Error("--out is required (this script does not overwrite the bundled pack)");
  const report = await generate(opts);
  if (!opts.raw && report.puzzles.length < opts.count) {
    throw new Error(`only found ${report.puzzles.length} puzzles (pool ${report.poolSize}); raise --games`);
  }
  mkdirSync(dirname(resolve(opts.out)), { recursive: true });
  writeFileSync(resolve(opts.out), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.distribution));
  console.log(`wrote ${report.puzzles.length} puzzles to ${opts.out}`);
}

const invoked = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invoked) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
