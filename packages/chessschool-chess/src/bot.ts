import type { Chess, Move } from "chess.js";
import { bestMove, placement, VALUE } from "./engine";
import { load } from "./game";

export type BotId = "pip" | "cody" | "rooky" | "bishop" | "ivy" | "atlas";
/** @deprecated Phase 2 names, kept so saved games still load. */
export type LegacyLevel = "gentle" | "steady";
export type BotLevel = BotId;

export type BotInfo = {
  id: BotId;
  name: string;
  level: number;
  blurb: string;
  /** Rough strength for players, not a rating. */
  strength: string;
  takebacks: boolean;
};

export const BOTS: readonly BotInfo[] = [
  { id: "pip", name: "Pip", level: 1, blurb: "Just learned the moves. Loves shiny captures.", strength: "First games", takebacks: true },
  { id: "cody", name: "Cody", level: 2, blurb: "Plays gently and makes friendly mistakes.", strength: "Beginner", takebacks: true },
  { id: "rooky", name: "Rooky", level: 3, blurb: "Never leaves a piece hanging if it can help it.", strength: "Improving", takebacks: true },
  { id: "bishop", name: "Professor Bishop", level: 4, blurb: "Thinks two moves ahead and loves tricky diagonals.", strength: "Club beginner", takebacks: false },
  { id: "ivy", name: "Queen Ivy", level: 5, blurb: "Sharp tactics. Punishes loose pieces.", strength: "Club player", takebacks: false },
  { id: "atlas", name: "King Atlas", level: 6, blurb: "Cody's toughest friend. Calculates deeply.", strength: "Strong club", takebacks: false },
];
export const BOT_LEVELS: readonly BotId[] = BOTS.map((b) => b.id);
export const botInfo = (id: BotId) => BOTS.find((b) => b.id === id)!;
export const isBotId = (v: unknown): v is BotId => BOTS.some((b) => b.id === v);
/** Maps Phase 2 levels and unknown values onto the roster. */
export const toBotId = (v: unknown): BotId => (isBotId(v) ? v : v === "steady" ? "rooky" : "cody");

function score(chess: Chess): number {
  // From the side to move's point of view.
  let s = 0;
  for (const row of chess.board()) {
    for (const cell of row) {
      if (!cell) continue;
      const f = cell.square.charCodeAt(0) - 97;
      const r = Number(cell.square[1]) - 1;
      const v = VALUE[cell.type] + placement(cell.type, cell.color, f, r);
      s += cell.color === chess.turn() ? v : -v;
    }
  }
  return s;
}
const MATE = 100_000;
const byCaptureValue = (moves: Move[]) => [...moves].sort((a, b) => (b.captured ? VALUE[b.captured] : 0) - (a.captured ? VALUE[a.captured] : 0));

/** Position after our move, from our side: the worst of standing pat and every capture reply. */
function afterReplies(chess: Chess): number {
  const replies = chess.moves({ verbose: true });
  if (!replies.length) return chess.inCheck() ? MATE : 0;
  let worst = -score(chess);
  for (const r of replies) {
    if (!r.captured) continue;
    chess.move(r);
    worst = Math.min(worst, score(chess));
    chess.undo();
  }
  return worst;
}

const centre = (sq: string) => 6 - (Math.abs(3.5 - (sq.charCodeAt(0) - 97)) + Math.abs(3.5 - (Number(sq[1]) - 1)));

/** Cody's move for a bot on the roster (Phase 2 "gentle"/"steady" still work). */
export function chooseMove(fen: string, bot: BotId | LegacyLevel, rand: () => number = Math.random): Move | null {
  const id = toBotId(bot);
  const chess = load(fen);
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return null;

  if (id === "pip") {
    const captures = moves.filter((m) => m.captured);
    if (captures.length && rand() < 0.4) return captures[Math.floor(rand() * captures.length)];
    return moves[Math.floor(rand() * moves.length)];
  }

  if (id === "cody") {
    const mates = moves.filter((m) => m.san.endsWith("#"));
    if (mates.length && rand() < 0.5) return mates[0];
    const captures = moves.filter((m) => m.captured && VALUE[m.captured] >= VALUE[m.piece]);
    if (captures.length && rand() < 0.5) return captures[Math.floor(rand() * captures.length)];
    const calm = moves.filter((m) => m.piece !== "k");
    const pool = calm.length ? calm : moves;
    return pool.map((m) => ({ m, s: centre(m.to) + rand() * 6 })).sort((a, b) => b.s - a.s)[0].m;
  }

  if (id === "rooky") {
    let best: Move = moves[0];
    let bestScore = -Infinity;
    for (const m of byCaptureValue(moves)) {
      chess.move(m);
      const s = afterReplies(chess) + rand() * 5;
      chess.undo();
      if (s > bestScore) {
        bestScore = s;
        best = m;
      }
    }
    return best;
  }

  const opts = {
    bishop: { depth: 2, quiescence: 2, timeMs: 700, noise: 18 },
    ivy: { depth: 3, quiescence: 4, timeMs: 1100, noise: 8 },
    atlas: { depth: 4, quiescence: 6, timeMs: 1600, noise: 2 },
  }[id];
  return bestMove(fen, opts, rand);
}
