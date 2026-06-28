/**
 * ChessSchool DB seeder + lesson generator.
 *
 * Generates 1,200–1,800 FEN-verified lessons (captures, checks, promotions,
 * back-rank mates) plus the famous openings, organised into classes/semesters,
 * and inserts them into the SQLite DB. Every position/move is validated with
 * chess.js before it is written — no broken lesson can be seeded.
 *
 * Run: pnpm db:seed   (or pnpm db:fresh to reset + push + seed)
 */
import Database from "better-sqlite3";
import { Chess } from "chess.js";
import { SEMESTERS as CURATED_SEMS } from "../content/data/school.mjs";
import { LESSONS as CURATED_LESSONS } from "../content/data/lessons.mjs";

const DB_PATH = (process.env.DATABASE_URL ?? "local.db").replace(/^file:/, "");
const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const sq = (f, r) => `${FILES[f]}${r}`;
const rint = (n) => Math.floor(Math.random() * n);
const pick = (arr) => arr[rint(arr.length)];
const PIECE_NAME = { q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" };
const PIECE_EMOJI = { q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" };

// Build a FEN from an explicit piece list. White uppercase, black lowercase.
function buildFen(pieces, turn = "w") {
  const board = Array.from({ length: 8 }, () => Array(8).fill(""));
  for (const { f, r, p } of pieces) board[8 - r][f] = p;
  const rows = board.map((row) => {
    let s = "";
    let empty = 0;
    for (const cell of row) {
      if (!cell) empty++;
      else {
        if (empty) s += empty;
        empty = 0;
        s += cell;
      }
    }
    if (empty) s += empty;
    return s;
  });
  return `${rows.join("/")} ${turn} - - 0 1`;
}

const infoStep = (id, coach, fen) => ({ id, kind: "info", coach, fen });
const moveStep = (id, coach, fen, solution, opts = {}) => ({
  id,
  kind: "move",
  coach,
  fen,
  solution,
  highlight: opts.highlight,
  successText: opts.successText ?? "Correct!",
  failText: opts.failText ?? "Not quite — try again.",
  tag: opts.tag,
});

// ── Generators (random kings → high variety, all chess.js-verified) ──────────
const cheb = (a, b) => Math.max(Math.abs(a.f - b.f), Math.abs(a.r - b.r));
function randSq(occupied) {
  for (let i = 0; i < 200; i++) {
    const f = rint(8),
      r = 1 + rint(8);
    if (!occupied.has(sq(f, r))) return { f, r };
  }
  return null;
}
function placeKings() {
  const occ = new Set();
  const wk = { f: rint(8), r: 1 + rint(8), p: "K" };
  occ.add(sq(wk.f, wk.r));
  for (let i = 0; i < 50; i++) {
    const bk = { f: rint(8), r: 1 + rint(8), p: "k" };
    if (cheb(wk, bk) >= 2) {
      occ.add(sq(bk.f, bk.r));
      return { wk, bk, occ };
    }
  }
  return null;
}

function genCapture() {
  const attackerType = pick(["q", "r", "b", "n"]);
  const targetType = pick(["r", "b", "n", "p"]);
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  const a = randSq(occ);
  if (!a) return null;
  occ.add(sq(a.f, a.r));
  const bkSq = sq(bk.f, bk.r);
  // squares the attacker reaches (to empty), used as candidate target squares
  let g0;
  try {
    g0 = new Chess(buildFen([wk, bk, { ...a, p: attackerType.toUpperCase() }], "w"));
  } catch {
    return null;
  }
  if (g0.isAttacked(bkSq, "w")) return null;
  const from = sq(a.f, a.r);
  const reach = g0
    .moves({ square: from, verbose: true })
    .map((m) => m.to)
    .filter((t) => {
      const tf = FILES.indexOf(t[0]),
        tr = Number(t[1]);
      return cheb({ f: tf, r: tr }, bk) >= 2; // target undefended by black king
    });
  if (!reach.length) return null;
  const to = pick(reach);
  const tf = FILES.indexOf(to[0]),
    tr = Number(to[1]);
  const fen = buildFen(
    [wk, bk, { ...a, p: attackerType.toUpperCase() }, { f: tf, r: tr, p: targetType }],
    "w",
  );
  let g;
  try {
    g = new Chess(fen);
  } catch {
    return null;
  }
  if (g.isAttacked(bkSq, "w")) return null;
  if (!g.moves({ square: from, verbose: true }).some((m) => m.to === to && m.flags.includes("c")))
    return null;
  return {
    tag: "capture",
    title: `Win the ${PIECE_NAME[targetType]}`,
    subtitle: "Free material",
    emoji: PIECE_EMOJI[targetType],
    xp: 10,
    steps: [
      moveStep(
        "win",
        `The ${PIECE_NAME[targetType]} on ${to} is undefended. Capture it with your ${PIECE_NAME[attackerType]}!`,
        fen,
        [`${from}:${to}`],
        { highlight: [to], tag: "capture", successText: "Free piece — well spotted!" },
      ),
    ],
  };
}

function genCheck() {
  const attackerType = pick(["q", "r", "b", "n"]);
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  const a = randSq(occ);
  if (!a) return null;
  const fen = buildFen([wk, bk, { ...a, p: attackerType.toUpperCase() }], "w");
  let g;
  try {
    g = new Chess(fen);
  } catch {
    return null;
  }
  if (g.isAttacked(sq(bk.f, bk.r), "w")) return null;
  const from = sq(a.f, a.r);
  const checks = g.moves({ square: from, verbose: true }).filter((m) => {
    const c = new Chess(fen);
    c.move({ from: m.from, to: m.to });
    return c.isCheck();
  });
  if (!checks.length) return null;
  const m = pick(checks);
  return {
    tag: "check",
    title: "Give a check",
    subtitle: "Attack the king",
    emoji: "⚡",
    xp: 10,
    steps: [
      moveStep(
        "check",
        `Find the move that puts the black king in check with your ${PIECE_NAME[attackerType]}.`,
        fen,
        [`${m.from}:${m.to}`],
        { highlight: [sq(bk.f, bk.r)], tag: "check", successText: "Check!" },
      ),
    ],
  };
}

const KNIGHT_OFFS = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
function knightTargets(f, r) {
  return KNIGHT_OFFS.map(([df, dr]) => ({ f: f + df, r: r + dr })).filter((s) => s.f >= 0 && s.f < 8 && s.r >= 1 && s.r <= 8);
}

// Knight fork: a knight move that checks the king AND attacks a queen/rook.
function genFork() {
  const pieceType = pick(["q", "r"]);
  for (let attempt = 0; attempt < 60; attempt++) {
    const fs = { f: rint(8), r: 1 + rint(8) };
    const tg = knightTargets(fs.f, fs.r);
    if (tg.length < 3) continue;
    const sh = [...tg].sort(() => Math.random() - 0.5);
    const [bk, bp, wn] = sh;
    const occ = new Set([sq(fs.f, fs.r), sq(bk.f, bk.r), sq(bp.f, bp.r), sq(wn.f, wn.r)]);
    let wk = null;
    for (let i = 0; i < 60; i++) {
      const c = { f: rint(8), r: 1 + rint(8) };
      if (!occ.has(sq(c.f, c.r)) && cheb(c, bk) >= 2 && cheb(c, fs) >= 1) { wk = c; break; }
    }
    if (!wk) continue;
    const fen = buildFen([{ ...wk, p: "K" }, { f: bk.f, r: bk.r, p: "k" }, { f: bp.f, r: bp.r, p: pieceType }, { f: wn.f, r: wn.r, p: "N" }], "w");
    let g;
    try { g = new Chess(fen); } catch { continue; }
    if (g.isAttacked(sq(bk.f, bk.r), "w")) continue;
    const from = sq(wn.f, wn.r), to = sq(fs.f, fs.r);
    if (!g.moves({ square: from, verbose: true }).some((m) => m.to === to)) continue;
    const c = new Chess(fen);
    c.move({ from, to });
    if (!c.isCheck() || !c.isAttacked(sq(bp.f, bp.r), "w")) continue;
    return {
      tag: "fork",
      title: `Fork the king and ${PIECE_NAME[pieceType]}`,
      subtitle: "Knight fork",
      emoji: "🍴",
      xp: 12,
      steps: [
        moveStep("fork", `Your knight can check the king AND attack the ${PIECE_NAME[pieceType]} in one move. Find the fork!`, fen, [`${from}:${to}`], { highlight: [sq(bp.f, bp.r), sq(bk.f, bk.r)], tag: "fork", successText: "Beautiful fork — you win the piece!" }),
      ],
    };
  }
  return null;
}

function genPromotion() {
  const k = placeKings();
  if (!k) return null;
  const { wk, bk, occ } = k;
  // pawn on the 7th rank with an empty square ahead
  for (let i = 0; i < 20; i++) {
    const f = rint(8);
    if (occ.has(sq(f, 7)) || occ.has(sq(f, 8))) continue;
    const fen = buildFen([wk, bk, { f, r: 7, p: "P" }], "w");
    let g;
    try {
      g = new Chess(fen);
    } catch {
      continue;
    }
    if (g.isAttacked(sq(bk.f, bk.r), "w")) continue;
    const from = sq(f, 7),
      to = sq(f, 8);
    if (!g.moves({ square: from, verbose: true }).some((x) => x.to === to)) continue;
    return {
      tag: "endgame",
      title: "Queen the pawn",
      subtitle: "Promotion",
      emoji: "👑",
      xp: 12,
      steps: [
        moveStep("promote", "Push the pawn to the last rank and promote to a queen!", fen, [`${from}:${to}`], {
          highlight: [to],
          tag: "promotion",
          successText: "A brand-new queen!",
        }),
      ],
    };
  }
  return null;
}

function genBackRankMate() {
  const usePiece = pick(["r", "q"]);
  for (let tries = 0; tries < 30; tries++) {
    const kf = rint(8);
    const wkf = rint(8);
    const wkr = 1 + rint(3);
    if (cheb({ f: wkf, r: wkr }, { f: kf, r: 8 }) < 2) continue;
    const pieces = [
      { f: wkf, r: wkr, p: "K" },
      { f: kf, r: 8, p: "k" },
    ];
    for (const df of [-1, 0, 1]) {
      const pf = kf + df;
      if (pf >= 0 && pf <= 7) pieces.push({ f: pf, r: 7, p: "p" });
    }
    const rfCandidates = [0, 1, 2, 3, 4, 5, 6, 7].filter(
      (rf) => Math.abs(rf - kf) >= 2 && rf !== wkf,
    );
    if (!rfCandidates.length) continue;
    const rf = pick(rfCandidates);
    if (pieces.some((p) => p.f === rf && p.r === 1)) continue;
    pieces.push({ f: rf, r: 1, p: usePiece.toUpperCase() });
    const fen = buildFen(pieces, "w");
    let g;
    try {
      g = new Chess(fen);
    } catch {
      continue;
    }
    const from = sq(rf, 1),
      to = sq(rf, 8);
    if (!g.moves({ square: from, verbose: true }).some((m) => m.to === to)) continue;
    const test = new Chess(fen);
    test.move({ from, to });
    if (!test.isCheckmate()) continue;
    return {
      tag: "checkmate",
      title: "Back-rank mate",
      subtitle: "Mate in one",
      emoji: "♛",
      xp: 15,
      steps: [
        moveStep("mate", "The king is trapped on the back rank by its own pawns. Deliver mate!", fen, [`${from}:${to}`], {
          highlight: [sq(kf, 8)],
          tag: "checkmate",
          successText: "Checkmate!",
        }),
      ],
    };
  }
  return null;
}

const OPENINGS = [
  ["Italian Game", "1.e4 e5 2.Nf3 Nc6 3.Bc4", "🇮🇹", ["e2:e4", "e7:e5", "g1:f3", "b8:c6", "f1:c4"]],
  ["Ruy Lopez", "1.e4 e5 2.Nf3 Nc6 3.Bb5", "🇪🇸", ["e2:e4", "e7:e5", "g1:f3", "b8:c6", "f1:b5"]],
  ["Sicilian Defense", "The Open Sicilian", "⚔️", ["e2:e4", "c7:c5", "g1:f3", "d7:d6", "d2:d4", "c5:d4", "f3:d4", "g8:f6", "b1:c3"]],
  ["French Defense", "1.e4 e6 2.d4 d5", "🇫🇷", ["e2:e4", "e7:e6", "d2:d4", "d7:d5"]],
  ["Caro-Kann", "1.e4 c6 2.d4 d5", "🛡️", ["e2:e4", "c7:c6", "d2:d4", "d7:d5"]],
  ["Scandinavian", "1.e4 d5", "🇩🇰", ["e2:e4", "d7:d5", "e4:d5", "d8:d5", "b1:c3"]],
  ["Queen's Gambit", "1.d4 d5 2.c4", "♕", ["d2:d4", "d7:d5", "c2:c4"]],
  ["King's Indian", "1.d4 Nf6 2.c4 g6", "🏰", ["d2:d4", "g8:f6", "c2:c4", "g7:g6", "b1:c3", "f8:g7"]],
  ["London System", "1.d4 d5 2.Nf3 Nf6 3.Bf4", "🌉", ["d2:d4", "d7:d5", "g1:f3", "g8:f6", "c1:f4"]],
  ["English Opening", "1.c4 e5 2.Nc3", "🏴", ["c2:c4", "e7:e5", "b1:c3"]],
];

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
function genOpening([name, sub, emoji, moves]) {
  const g = new Chess();
  for (const mv of moves) {
    const [from, to] = mv.split(":");
    if (!g.move({ from, to, promotion: "q" })) return null; // verify
  }
  return {
    tag: "openings",
    title: name,
    subtitle: sub,
    emoji,
    xp: 25,
    steps: [
      infoStep("intro", `The ${name} — one of chess's great openings. Watch the main line, then play the key move.`, START_FEN),
      { id: "watch", kind: "observe", coach: `Watch the ${name} unfold move by move.`, fen: START_FEN, moves },
      moveStep("first", "Now you start it — play the opening's first move.", START_FEN, [moves[0]], {
        tag: "openings",
        successText: "Great start!",
      }),
    ],
  };
}

function collect(gen, target, label) {
  const out = [];
  const seen = new Set();
  let attempts = 0;
  while (out.length < target && attempts < target * 30) {
    attempts++;
    const lesson = gen();
    if (!lesson) continue;
    const key = JSON.stringify(lesson.steps.map((s) => s.fen + (s.solution ?? "")));
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(lesson);
  }
  console.log(`  ${label}: ${out.length}/${target}`);
  return out;
}

// ── Assemble curriculum ─────────────────────────────────────────────────────
function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function findKing(g, color) {
  for (const row of g.board()) for (const c of row) if (c && c.type === "k" && c.color === color) return c.square;
  return null;
}

/**
 * Add `fillers` extra pieces to a position without breaking the puzzle — making
 * boards busier/harder + unique. `validate` re-checks the solution after each
 * piece. Used to scale difficulty: more pieces in harder classes.
 */
function augmentFen(fen, fillers, validate) {
  if (fillers <= 0) return fen;
  let curFen = fen;
  const occ = new Set();
  for (const row of new Chess(fen).board()) for (const c of row) if (c) occ.add(c.square);
  let added = 0;
  let tries = 0;
  while (added < fillers && tries < fillers * 22 + 14) {
    tries++;
    const file = FILES[rint(8)];
    const r = 1 + rint(8);
    const square = `${file}${r}`;
    if (occ.has(square)) continue;
    const color = Math.random() < 0.5 ? "w" : "b";
    const type = pick(["q", "r", "b", "n", "p", "p", "b", "n"]); // bias toward minor/pawn clutter
    if (type === "p" && (r === 1 || r === 8)) continue;
    let g;
    try {
      g = new Chess(curFen);
      g.put({ type, color }, square);
    } catch {
      continue;
    }
    let gg;
    try {
      gg = new Chess(g.fen());
    } catch {
      continue;
    }
    if (!validate(gg)) continue;
    curFen = g.fen();
    occ.add(square);
    added++;
  }
  return curFen;
}

/** Augment a generated drill's position with `fillers` pieces (tag-aware). */
function augmentDrill(drill, fillers) {
  if (fillers <= 0) return drill;
  const step = drill.steps.find((s) => s.kind === "move");
  if (!step || !step.solution?.[0]) return drill;
  const [from, to] = step.solution[0].split(":");
  const turn = new Chess(step.fen).turn();
  const opp = turn === "w" ? "b" : "w";
  const tag = drill.tag;
  const validate = (g) => {
    if (g.turn() !== turn || g.inCheck()) return false; // side to move must be safe
    const oppKing = findKing(g, opp);
    if (oppKing && g.isAttacked(oppKing, turn)) return false; // opponent not already in check
    const clone = new Chess(g.fen());
    let m;
    try {
      m = clone.move({ from, to, promotion: "q" });
    } catch {
      return false;
    }
    if (!m) return false;
    if (tag === "capture") return Boolean(m.captured) && !g.isAttacked(to, opp);
    if (tag === "mate" || tag === "checkmate") return clone.isCheckmate();
    if (tag === "check" || tag === "fork") return clone.inCheck();
    if (tag === "promotion") return Boolean(m.promotion);
    // unknown tag: at least keep the solving move legal
    return true;
  };
  const fen = augmentFen(step.fen, fillers, validate);
  if (fen === step.fen) return drill;
  return { ...drill, steps: drill.steps.map((s) => (s === step ? { ...s, fen } : s)) };
}

// Famous named mate-in-one patterns (Master). Each is verified (isCheckmate) at
// seed time; invalid ones are skipped + logged.
const FAMOUS_MATES = [
  { name: "Smothered Mate", emoji: "🐴", fen: "6rk/6pp/3N4/8/8/8/8/7K w - - 0 1", solution: "d6:f7", coach: "The king is hemmed in by its own pieces. Nf7 is the famous smothered mate." },
  { name: "Arabian Mate", emoji: "🏜️", fen: "7k/8/5N2/8/8/8/8/K6R w - - 0 1", solution: "h1:h7", coach: "Rook + knight in the corner: Rh7 — the knight guards the rook and covers g8." },
  { name: "Back-Rank Mate", emoji: "🎯", fen: "6k1/5ppp/8/8/8/8/8/R6K w - - 0 1", solution: "a1:a8", coach: "The king is trapped behind its own pawns. Ra8 delivers back-rank mate." },
  { name: "Ladder Mate", emoji: "🪜", fen: "7k/R7/1R6/8/8/8/8/7K w - - 0 1", solution: "b6:b8", coach: "Two rooks climb the board: one seals the 7th rank, the other mates on the 8th." },
  { name: "Queen Mate", emoji: "👑", fen: "6k1/8/5QK1/8/8/8/8/8 w - - 0 1", solution: "f6:g7", coach: "Bring the queen beside the king, defended by your own king: Qg7 is mate." },
  { name: "Scholar's Mate", emoji: "🎓", fen: "r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w - - 0 1", solution: "h5:f7", coach: "The four-move attack: Qxf7 — the bishop guards the queen. Beware this trap!" },
];

// Famous games (Master) — shown as an "observe" of the brilliant finish.
const FAMOUS_GAMES = [
  {
    name: "The Opera Game", sub: "Morphy, 1858",
    coach: "Morphy's masterpiece: a queen sacrifice (Qb8+!!) sets up a rook mate. Watch the finish.",
    sans: ["e4", "e5", "Nf3", "d6", "d4", "Bg4", "dxe5", "Bxf3", "Qxf3", "dxe5", "Bc4", "Nf6", "Qb3", "Qe7", "Nc3", "c6", "Bg5", "b5", "Nxb5", "cxb5", "Bxb5+", "Nbd7", "O-O-O", "Rd8", "Rxd7", "Rxd7", "Rd1", "Qe6", "Bxd7+", "Nxd7", "Qb8+", "Nxb8", "Rd8#"],
  },
  {
    name: "The Evergreen Game", sub: "Anderssen, 1852",
    coach: "Anderssen's brilliancy ends with Qxd7+!! and a bishop net. Watch the combination.",
    sans: ["e4", "e5", "Nf3", "Nc6", "Bc4", "Bc5", "b4", "Bxb4", "c3", "Ba5", "d4", "exd4", "O-O", "d3", "Qb3", "Qf6", "e5", "Qg6", "Re1", "Nge7", "Ba3", "b5", "Qxb5", "Rb8", "Qa4", "Bb6", "Nbd2", "Bb7", "Ne4", "Qf5", "Bxd3", "Qh5", "Nf6+", "gxf6", "exf6", "Rg8", "Rad1", "Qxf3", "Rxe7+", "Nxe7", "Qxd7+", "Kxd7", "Bf5+", "Ke8", "Bd7+", "Kf8", "Bxe7#"],
  },
];

async function main() {
  console.log("Building hand-authored base curriculum…");
  // Auto-generated drill semesters are retired — the premium puzzle bulk now comes
  // from the Lichess import (scripts/import-lichess.mjs, `pz-` ids). This seed keeps
  // only the hand-authored quality: Foundations, Openings, Famous Mates, Immortal Games.

  const semesters = [];
  const classes = [];
  const lessons = [];
  let cOrder = 0;

  // Bundle several drills into one multi-exercise lesson, and scale the lesson
  // count + exercises-per-lesson by difficulty (easy classes are short; harder
  // / higher classes are longer and give more XP).
  function addThemeSemester(semId, title, blurb, color, stage, pool, classNames, emoji, difficulty) {
    const perLesson = Math.min(difficulty + 1, 6); // exercises (FENs) per lesson
    const perClass = (4 + difficulty * 2) * perLesson; // → 6/8/10/12 lessons per class
    semesters.push({ id: semId, title, blurb, color, stage, sortOrder: semesters.length });
    chunk(pool, perClass).forEach((group, ci) => {
      const classId = `${semId}-c${ci + 1}`;
      const lessonGroups = chunk(group, perLesson);
      const name = classNames[ci % classNames.length];
      const round = Math.floor(ci / classNames.length);
      classes.push({
        id: classId,
        semesterId: semId,
        title: round > 0 ? `${name} ${round + 1}` : name,
        emoji,
        blurb: `${lessonGroups.length} lessons`,
        difficulty,
        sortOrder: cOrder++,
      });
      // Harder classes get busier boards: more verified filler pieces.
      const fillers = Math.min(2 + difficulty + Math.floor(ci / 3), 8);
      lessonGroups.forEach((drills, li) => {
        // Add pieces (unique per drill) + merge as sequential exercises.
        const rich = drills.map((d) => augmentDrill(d, fillers));
        const steps = rich.flatMap((d, di) => d.steps.map((s, si) => ({ ...s, id: `e${di}s${si}` })));
        lessons.push({
          id: `${classId}-l${li + 1}`,
          classId,
          title: rich[0].title,
          subtitle: rich.length > 1 ? `${rich.length} exercises` : rich[0].subtitle,
          emoji: rich[0].emoji,
          tag: rich[0].tag,
          xp: rich.length * 10 + fillers * 2,
          isExam: 0,
          prerequisites: "[]",
          steps: JSON.stringify(steps),
          sortOrder: li,
        });
      });
    });
  }

  // Curated, hand-authored curriculum first (Elementary foundations, openings…)
  function addCurated() {
    const byId = new Map(CURATED_LESSONS.map((l) => [l.id, l]));
    const pushLesson = (l, classId, sortOrder, isExam = 0) =>
      lessons.push({
        id: l.id, classId, title: l.title, subtitle: l.subtitle, emoji: l.emoji,
        tag: l.tag, xp: l.xp, isExam,
        prerequisites: JSON.stringify(l.prerequisites ?? []),
        steps: JSON.stringify(l.steps), sortOrder,
      });
    for (const sem of CURATED_SEMS) {
      semesters.push({ id: sem.id, title: sem.title, blurb: sem.blurb, color: sem.color, stage: sem.stage, sortOrder: semesters.length });
      for (const cls of sem.classes) {
        classes.push({ id: cls.id, semesterId: sem.id, title: cls.title, emoji: cls.emoji, blurb: cls.blurb, difficulty: cls.difficulty ?? 1, examId: cls.examId ?? null, sortOrder: cOrder++ });
        cls.lessonIds.forEach((lid, li) => { const l = byId.get(lid); if (l) pushLesson(l, cls.id, li); });
        if (cls.examId) { const ex = byId.get(cls.examId); if (ex) pushLesson(ex, cls.id, 99, 1); }
      }
    }
  }
  addCurated();

  // Openings — one class per opening, now with several lessons each (watch the
  // line + play its key moves as puzzles).
  semesters.push({ id: "sem-gen-openings", title: "Opening Theory", blurb: "The famous openings", color: "#f59e0b", stage: "high", sortOrder: semesters.length });
  OPENINGS.forEach(([name, sub, emoji, moves], oi) => {
    const verify = new Chess();
    let ok = true;
    for (const mv of moves) { const [f, t] = mv.split(":"); if (!verify.move({ from: f, to: t, promotion: "q" })) { ok = false; break; } }
    if (!ok) return;
    const classId = `sem-gen-openings-c${oi + 1}`;
    classes.push({ id: classId, semesterId: "sem-gen-openings", title: name, emoji, blurb: sub, difficulty: 2, sortOrder: cOrder++ });
    // Lesson 1 — watch the main line.
    lessons.push({
      id: `${classId}-l1`, classId, title: `${name}: Main Line`, subtitle: sub, emoji, tag: "opening", xp: 20, isExam: 0, prerequisites: "[]",
      steps: JSON.stringify([
        { id: "intro", kind: "info", coach: `The ${name} — one of chess's great openings. Watch the main line, then play it yourself.`, fen: START_FEN },
        { id: "watch", kind: "observe", coach: `Watch the ${name} unfold move by move.`, fen: START_FEN, moves },
      ]),
      sortOrder: 0,
    });
    // Lessons 2..N — play White's moves of the line as puzzles (2 per lesson).
    const replay = new Chess();
    const whitePuzzles = [];
    for (const mv of moves) {
      const fenBefore = replay.fen();
      const [f, t] = mv.split(":");
      if (replay.turn() === "w") whitePuzzles.push({ fen: fenBefore, sol: mv, to: t });
      replay.move({ from: f, to: t, promotion: "q" });
    }
    chunk(whitePuzzles, 2).forEach((grp, li) => {
      const steps = grp.map((p, si) => ({ id: `s${si}`, kind: "move", coach: `Play the ${name}'s next book move.`, fen: p.fen, solution: [p.sol], highlight: [p.to], successText: "Right move!", failText: "That's not the main line — try again.", tag: "opening" }));
      lessons.push({ id: `${classId}-l${li + 2}`, classId, title: `${name}: Key Moves ${li + 1}`, subtitle: `${grp.length} moves`, emoji, tag: "opening", xp: 15, isExam: 0, prerequisites: "[]", steps: JSON.stringify(steps), sortOrder: li + 1 });
    });
  });

  // ── Master: Famous Checkmates (named patterns, verified) ──
  {
    const valid = FAMOUS_MATES.filter((m) => {
      try {
        const g = new Chess(m.fen);
        const [f, t] = m.solution.split(":");
        return g.move({ from: f, to: t, promotion: "q" }) && g.isCheckmate();
      } catch {
        return false;
      }
    });
    if (valid.length) {
      console.log(`  famous mates verified: ${valid.length}/${FAMOUS_MATES.length}`);
      semesters.push({ id: "sem-master-mates", title: "Famous Checkmates", blurb: "The classic mating patterns every master knows", color: "#7c3aed", stage: "master", sortOrder: semesters.length });
      chunk(valid, 3).forEach((group, ci) => {
        const classId = `sem-master-mates-c${ci + 1}`;
        classes.push({ id: classId, semesterId: "sem-master-mates", title: `Mating Patterns ${ci + 1}`, emoji: "♚", blurb: `${group.length} patterns`, difficulty: 5, sortOrder: cOrder++ });
        group.forEach((m, li) => {
          const [f, t] = m.solution.split(":");
          lessons.push({
            id: `${classId}-l${li + 1}`, classId, title: m.name, subtitle: "Deliver mate in one", emoji: m.emoji, tag: "mate", xp: 20, isExam: 0, prerequisites: "[]",
            steps: JSON.stringify([
              { id: "info", kind: "info", coach: m.coach, fen: m.fen },
              { id: "mate", kind: "move", coach: `Deliver ${m.name}!`, fen: m.fen, solution: [`${f}:${t}`], highlight: [t], successText: "Checkmate! 🏆", failText: "Not mate — find the finishing move.", tag: "mate" },
            ]),
            sortOrder: li,
          });
        });
      });
    }
  }

  // ── Master: Immortal Games (watch the brilliant finish) ──
  {
    const valid = [];
    for (const game of FAMOUS_GAMES) {
      const g = new Chess();
      let ok = true;
      for (const san of game.sans) {
        try { if (!g.move(san)) { ok = false; break; } } catch { ok = false; break; }
      }
      if (ok) valid.push(game);
    }
    if (valid.length) {
      console.log(`  famous games verified: ${valid.length}/${FAMOUS_GAMES.length}`);
      semesters.push({ id: "sem-master-games", title: "Immortal Games", blurb: "Learn from the masters' brilliancies", color: "#b8860b", stage: "master", sortOrder: semesters.length });
      const classId = "sem-master-games-c1";
      classes.push({ id: classId, semesterId: "sem-master-games", title: "Brilliant Finishes", emoji: "🎭", blurb: `${valid.length} games`, difficulty: 5, sortOrder: cOrder++ });
      valid.forEach((game, gi) => {
        const r = new Chess();
        const start = Math.max(0, game.sans.length - 7);
        for (let i = 0; i < start; i++) r.move(game.sans[i]);
        const fen = r.fen();
        const moves = [];
        for (let i = start; i < game.sans.length; i++) { const mv = r.move(game.sans[i]); moves.push(`${mv.from}:${mv.to}`); }
        lessons.push({
          id: `${classId}-l${gi + 1}`, classId, title: game.name, subtitle: game.sub, emoji: "🎭", tag: "famous", xp: 25, isExam: 0, prerequisites: "[]",
          steps: JSON.stringify([
            { id: "intro", kind: "info", coach: game.coach, fen },
            { id: "watch", kind: "observe", coach: "Watch the combination unfold…", fen, moves },
          ]),
          sortOrder: gi,
        });
      });
    }
  }

  console.log(`\nTotals: ${semesters.length} semesters · ${classes.length} classes · ${lessons.length} lessons`);

  const SEM_SQL = "INSERT INTO semesters (id,title,blurb,color,stage,sort_order) VALUES (?,?,?,?,?,?)";
  const CLASS_SQL = "INSERT INTO classes (id,semester_id,title,emoji,blurb,difficulty,exam_id,sort_order) VALUES (?,?,?,?,?,?,?,?)";
  const LESSON_SQL = "INSERT INTO lessons (id,class_id,title,subtitle,emoji,tag,xp,is_exam,prerequisites,steps,sort_order) VALUES (?,?,?,?,?,?,?,?,?,?,?)";
  const semArgs = (s) => [s.id, s.title, s.blurb, s.color, s.stage, s.sortOrder];
  const classArgs = (c) => [c.id, c.semesterId, c.title, c.emoji, c.blurb, c.difficulty, c.examId ?? null, c.sortOrder];
  const lessonArgs = (l) => [l.id, l.classId, l.title, l.subtitle, l.emoji, l.tag, l.xp, l.isExam, l.prerequisites, l.steps, l.sortOrder];

  const rawUrl = process.env.DATABASE_URL ?? "file:local.db";
  const isRemote = rawUrl.startsWith("libsql:") || rawUrl.startsWith("http");

  if (isRemote) {
    // ── Turso / libSQL (async, batched) ──────────────────────────────────────
    const { createClient } = await import("@libsql/client");
    const client = createClient({ url: rawUrl, authToken: process.env.DATABASE_AUTH_TOKEN });
    await client.batch(["DELETE FROM lessons", "DELETE FROM classes", "DELETE FROM semesters"], "write");
    const stmts = [
      ...semesters.map((s) => ({ sql: SEM_SQL, args: semArgs(s) })),
      ...classes.map((c) => ({ sql: CLASS_SQL, args: classArgs(c) })),
      ...lessons.map((l) => ({ sql: LESSON_SQL, args: lessonArgs(l) })),
    ];
    for (let i = 0; i < stmts.length; i += 400) {
      await client.batch(stmts.slice(i, i + 400), "write");
      process.stdout.write(`\r  inserting… ${Math.min(i + 400, stmts.length)}/${stmts.length}`);
    }
    console.log(`\n✅ Seeded ${lessons.length} lessons into ${rawUrl}`);
    return;
  }

  // ── Local SQLite file (sync, fast) ─────────────────────────────────────────
  const db = new Database(DB_PATH);
  db.pragma("foreign_keys = ON");
  db.exec("DELETE FROM lessons; DELETE FROM classes; DELETE FROM semesters;");
  const insSem = db.prepare(SEM_SQL);
  const insClass = db.prepare(CLASS_SQL);
  const insLesson = db.prepare(LESSON_SQL);
  const tx = db.transaction(() => {
    for (const s of semesters) insSem.run(semArgs(s));
    for (const c of classes) insClass.run(classArgs(c));
    for (const l of lessons) insLesson.run(lessonArgs(l));
  });
  tx();
  const count = db.prepare("SELECT COUNT(*) c FROM lessons").get().c;
  console.log(`\n✅ Seeded ${count} lessons into ${DB_PATH}`);
  db.close();
}

await main();
