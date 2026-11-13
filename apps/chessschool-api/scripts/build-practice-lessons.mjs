// Builds the practice units (20, 22, … 42) of data/course.json from the CC0 Lichess puzzles in
// packages/puzzle-school/data/puzzles. Every position is replayed with chess.js, turned so the
// learner plays White, and ordered from easy to hard. Other units in course.json are kept as they are.
// Then load it with: pnpm --filter chessschool-api seed:course (dry-run first; see README).
// Run: pnpm --filter chessschool-api build:practice
import { Chess } from "chess.js";
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const DATA = join(root, "packages/puzzle-school/data/puzzles");
const POSITIONS_PER_LESSON = 5;

/** Stage, which slice of its rating range, and the longest solution (learner + reply moves). */
const UNITS = [
  { stage: "novice", part: 0, parts: 3, maxSolve: 1, level: "Starter I" },
  { stage: "novice", part: 1, parts: 3, maxSolve: 1, level: "Starter II" },
  { stage: "novice", part: 2, parts: 3, maxSolve: 3, level: "Starter III" },
  { stage: "elementary", part: 0, parts: 3, maxSolve: 3, level: "Elementary I" },
  { stage: "elementary", part: 1, parts: 3, maxSolve: 3, level: "Elementary II" },
  { stage: "elementary", part: 2, parts: 3, maxSolve: 3, level: "Elementary III" },
  { stage: "middle", part: 0, parts: 2, maxSolve: 3, level: "Club I" },
  { stage: "middle", part: 1, parts: 2, maxSolve: 3, level: "Club II" },
  { stage: "high", part: 0, parts: 2, maxSolve: 5, level: "Strong I" },
  { stage: "high", part: 1, parts: 2, maxSolve: 5, level: "Strong II" },
  { stage: "university", part: 0, parts: 1, maxSolve: 5, level: "Advanced" },
  { stage: "master", part: 0, parts: 1, maxSolve: 5, level: "Master" },
];

const ORDER = ["mate", "fork", "pin", "discovered", "advantage", "trapped", "sacrifice", "endgame", "opening"];

/** Six ideas per unit, rotated so each idea comes back every few units; always shown in ORDER. */
const themesFor = (unitIndex) => {
  const start = (unitIndex % 3) * 3;
  const pick = new Set(Array.from({ length: 6 }, (_, i) => ORDER[(start + i) % ORDER.length]));
  return ORDER.filter((t) => pick.has(t));
};

const THEME = {
  mate: {
    name: "Checkmate",
    id: "Mate",
    intro: "Look for checks first. A checkmate is a check the king cannot escape: no safe square, no block, no capture.",
    task: "Find checkmate.",
  },
  fork: {
    name: "Forks",
    id: "Fork",
    intro: "A fork attacks two things with one move. They can only save one of them, so you win the other.",
    task: "Attack two things at once.",
  },
  pin: {
    name: "Pins",
    id: "Pin",
    intro: "A pinned piece cannot move without exposing something more valuable behind it. Attack it, or pin it yourself.",
    task: "Use the pin.",
  },
  discovered: {
    name: "Discovered attacks",
    id: "Discovered",
    intro: "Move one piece out of the way and the piece behind it attacks too. Two threats from one move.",
    task: "Unleash a hidden attacker.",
  },
  advantage: {
    name: "Win material",
    id: "Material",
    intro: "Something is loose or under-defended. Count attackers and defenders, then take what is free.",
    task: "Win material.",
  },
  trapped: {
    name: "Trapped pieces",
    id: "Trapped",
    intro: "A piece with no safe squares is lost. Take away its escape, then win it.",
    task: "Catch the trapped piece.",
  },
  sacrifice: {
    name: "Sacrifices",
    id: "Sacrifice",
    intro: "Sometimes you give a piece to get something bigger back: a mate, a queen, or a winning attack.",
    task: "Give something to get more back.",
  },
  endgame: {
    name: "Endgame technique",
    id: "Endgame",
    intro: "With few pieces left, every tempo counts. Push passed pawns, activate the king, and look for promotion tricks.",
    task: "Find the winning endgame move.",
  },
  opening: {
    name: "Opening traps",
    id: "Opening",
    intro: "Early mistakes leave pieces loose or the king open. Punish them right away.",
    task: "Punish the opening mistake.",
  },
};

const PIECE = { p: "pawn", n: "knight", b: "bishop", r: "rook", q: "queen", k: "king" };

/* ---------- board helpers ---------- */

const swapCase = (c) => (c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase());
const flipSquare = (sq) => `${sq[0]}${9 - Number(sq[1])}`;

/** The same position with colours swapped and the board turned, so Black to move becomes White to move. */
function mirrorFen(fen) {
  const [board, side, castling, ep, half, full] = fen.split(" ");
  const rows = board.split("/").reverse().map((row) => [...row].map((c) => (/[a-z]/i.test(c) ? swapCase(c) : c)).join(""));
  const rights = castling === "-" ? "-" : [..."KQkq"].filter((c) => castling.includes(swapCase(c))).join("") || "-";
  return [rows.join("/"), side === "w" ? "b" : "w", rights, ep === "-" ? "-" : flipSquare(ep), half, full].join(" ");
}
const mirrorUci = (m) => `${flipSquare(m.slice(0, 2))}${flipSquare(m.slice(2, 4))}${m.slice(4)}`;

function play(chess, uci) {
  return chess.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] });
}

/** Replays a Lichess line (setup move first). Returns the learner's position and solution, or null. */
function prepare(p) {
  try {
    const setup = new Chess(p.fen);
    if (!play(setup, p.line[0])) return null;
    let fen = setup.fen();
    let moves = p.line.slice(1);
    if (setup.turn() === "b") {
      fen = mirrorFen(fen);
      moves = moves.map(mirrorUci);
    }
    const chess = new Chess(fen);
    if (chess.turn() !== "w" || chess.isGameOver()) return null;
    const first = chess.get(moves[0].slice(0, 2));
    if (!first || first.color !== "w") return null;
    for (const m of moves) if (!play(chess, m)) return null;
    return { id: p.id, ref: p.sourceRef, rating: p.rating, fen, moves, mate: chess.isCheckmate(), piece: first.type, from: moves[0].slice(0, 2) };
  } catch {
    return null;
  }
}

/* ---------- selection ---------- */

const pools = new Map();
function pool(stage, theme) {
  const key = `${stage}/${theme}`;
  if (!pools.has(key)) {
    const rows = readFileSync(join(DATA, stage, `${theme}.jsonl`), "utf8").split("\n").filter(Boolean).map((l) => JSON.parse(l));
    pools.set(key, rows.map(prepare).filter(Boolean).sort((a, b) => a.rating - b.rating || a.id.localeCompare(b.id)));
  }
  return pools.get(key);
}

const used = new Set();
const seenFen = new Set();

/** Five positions spread evenly across this unit's slice of the stage, easiest first. */
function choose(unit, theme) {
  const fits = (max) => pool(unit.stage, theme).filter((p) => p.moves.length <= max && (theme !== "mate" || p.mate));
  // Some ideas (a fork, then the capture) rarely finish in one move; allow the next length up.
  const enough = (list) => list.length >= unit.parts * POSITIONS_PER_LESSON * 3;
  const all = enough(fits(unit.maxSolve)) ? fits(unit.maxSolve) : fits(unit.maxSolve + 2);
  const size = Math.floor(all.length / unit.parts);
  const slice = all.slice(unit.part * size, unit.part === unit.parts - 1 ? all.length : (unit.part + 1) * size);
  const picked = [];
  for (let i = 0; i < POSITIONS_PER_LESSON; i++) {
    const at = Math.floor(((i + 0.5) / POSITIONS_PER_LESSON) * slice.length);
    for (let d = 0; d < slice.length; d++) {
      const cand = slice[(at + d) % slice.length];
      if (used.has(cand.id) || seenFen.has(cand.fen.split(" ").slice(0, 2).join(" "))) continue;
      used.add(cand.id);
      seenFen.add(cand.fen.split(" ").slice(0, 2).join(" "));
      picked.push(cand);
      break;
    }
  }
  if (picked.length !== POSITIONS_PER_LESSON) throw new Error(`not enough positions for ${unit.level} ${theme}`);
  return picked.sort((a, b) => a.rating - b.rating);
}

/* ---------- copy ---------- */

const learnerMoves = (p) => (p.moves.length + 1) / 2;

function task(theme, p) {
  const n = learnerMoves(p);
  if (p.mate) return n === 1 ? "Checkmate in one move." : `Checkmate in ${n} moves.`;
  return n === 1 ? THEME[theme].task : `${THEME[theme].task} It takes ${n} moves.`;
}

function hint(p) {
  const start = `Start with your ${PIECE[p.piece]} on ${p.from}.`;
  return learnerMoves(p) > 1 ? `${start} After Black replies, look for the follow-up.` : start;
}

function lesson(unit, theme, positions) {
  const t = THEME[theme];
  const longest = Math.max(...positions.map(learnerMoves));
  const pace = longest === 1 ? "Each one takes a single move." : "Some take more than one move: keep going after Black replies.";
  return [
    { kind: "say", pose: "reading", title: `${t.name}.`, body: `${t.intro} ${pace}`, fen: positions[0].fen },
    ...positions.map((p, i) => ({
      kind: "line",
      pose: "thinking",
      title: `${t.name} ${i + 1} of ${positions.length}`,
      body: `White to move. ${task(theme, p)}`,
      fen: p.fen,
      moves: p.moves,
      hint: hint(p),
      ...(p.mate ? { mateEnds: true } : {}),
    })),
  ];
}

/* ---------- build ---------- */

const lessons = {};
const units = [];
UNITS.forEach((unit, u) => {
  const number = 20 + u * 2;
  const unitId = `unit${number}`;
  const themes = themesFor(u);
  const nodes = themes.map((theme) => {
    const positions = choose(unit, theme);
    const id = `practice${String(u + 1).padStart(2, "0")}${THEME[theme].id}`;
    lessons[id] = { id, steps: lesson(unit, theme, positions), sources: positions.map((p) => p.ref) };
    const counts = positions.map(learnerMoves);
    const lo = Math.min(...counts);
    const hi = Math.max(...counts);
    const span = lo === hi ? `${lo} ${lo === 1 ? "move" : "moves"} each` : `${lo}–${hi} moves each`;
    return { id, title: THEME[theme].name, sub: `${unit.level} · ${positions.length} positions, ${span}`, minutes: 5 + Math.max(0, unit.maxSolve - 1), xp: 20 + 5 * Math.floor(u / 3) };
  });
  units.push({ id: unitId, title: `Unit ${number} · Practice: ${unit.level}`, sub: themes.map((t) => THEME[t].name.toLowerCase()).join(", "), nodes });
});

const COURSE = join(root, "apps/chessschool-api/data/course.json");
const doc = JSON.parse(readFileSync(COURSE, "utf8"));
const practiceUnits = new Set(units.map((u) => u.id));
const unitNumber = (id) => Number(id.slice(4));
doc.units = [...doc.units.filter((u) => !practiceUnits.has(u.id)), ...units.map(({ id, title, sub }) => ({ id, title, sub }))].sort((a, b) => unitNumber(a.id) - unitNumber(b.id));
const order = new Map(doc.units.map((u, i) => [u.id, i]));
const kept = doc.lessons.filter((l) => !practiceUnits.has(l.unit));
const fresh = units.flatMap((u) => u.nodes.map((n) => ({ id: n.id, unit: u.id, title: n.title, sub: n.sub, minutes: n.minutes, xp: n.xp, steps: lessons[n.id].steps, sources: lessons[n.id].sources })));
// Stable sort keeps the order inside each unit.
doc.lessons = [...kept, ...fresh].sort((a, b) => order.get(a.unit) - order.get(b.unit));
writeFileSync(COURSE, JSON.stringify(doc, null, 1) + "\n");
console.log(`practice lessons: ${fresh.length} in ${units.length} units; course.json now has ${doc.lessons.length} lessons`);
