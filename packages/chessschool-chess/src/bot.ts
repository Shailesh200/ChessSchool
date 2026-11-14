import type { Move } from "chess.js";
import { rankMoves, type RankedMove } from "./engine";
import { load } from "./game";
import { sampleLoss } from "./mistakes";
import { phaseOf } from "./phase";

export type BotId = "pip" | "cody" | "rooky" | "bishop" | "ivy" | "atlas";
/** @deprecated Phase 2 names, kept so saved games still load. */
export type LegacyLevel = "gentle" | "steady";
export type BotLevel = BotId;

export type BotInfo = {
  id: BotId;
  name: string;
  level: number;
  blurb: string;
  /** Rough strength for players. */
  strength: string;
  /** Target playing rating (Lichess scale); each learner's copy adapts around it. */
  rating: number;
  takebacks: boolean;
};

export const BOTS: readonly BotInfo[] = [
  { id: "pip", name: "Pip", level: 1, blurb: "Just learned the moves. Loves shiny captures.", strength: "First games", rating: 400, takebacks: true },
  { id: "cody", name: "Cody", level: 2, blurb: "Plays gently and makes friendly mistakes.", strength: "Beginner", rating: 700, takebacks: true },
  { id: "rooky", name: "Rooky", level: 3, blurb: "Never leaves a piece hanging if it can help it.", strength: "Improving", rating: 1000, takebacks: true },
  { id: "bishop", name: "Professor Bishop", level: 4, blurb: "Thinks two moves ahead and loves tricky diagonals.", strength: "Club beginner", rating: 1250, takebacks: false },
  { id: "ivy", name: "Queen Ivy", level: 5, blurb: "Sharp tactics. Punishes loose pieces.", strength: "Club player", rating: 1500, takebacks: false },
  { id: "atlas", name: "King Atlas", level: 6, blurb: "Cody's toughest friend. Calculates deeply.", strength: "Strong club", rating: 1800, takebacks: false },
];
export const BOT_LEVELS: readonly BotId[] = BOTS.map((b) => b.id);
export const botInfo = (id: BotId) => BOTS.find((b) => b.id === id)!;
export const isBotId = (v: unknown): v is BotId => BOTS.some((b) => b.id === v);
/** Maps Phase 2 levels and unknown values onto the roster. */
export const toBotId = (v: unknown): BotId => (isBotId(v) ? v : v === "steady" ? "rooky" : "cody");

/** Search settings per bot; Ivy and Atlas think longer (up to ~2 s) so their low-loss moves are really good. */
const ENGINE: Record<BotId, { depth: number; quiescence: number; timeMs: number }> = {
  pip: { depth: 2, quiescence: 3, timeMs: 250 },
  cody: { depth: 2, quiescence: 3, timeMs: 350 },
  rooky: { depth: 3, quiescence: 4, timeMs: 500 },
  bishop: { depth: 3, quiescence: 4, timeMs: 700 },
  ivy: { depth: 4, quiescence: 5, timeMs: 1500 },
  atlas: { depth: 5, quiescence: 6, timeMs: 2000 },
};

const centre = (sq: string) => 6 - (Math.abs(3.5 - (sq.charCodeAt(0) - 97)) + Math.abs(3.5 - (Number(sq[1]) - 1)));

/** Opening moves people actually play (our quick eval barely tells Na3 from Nc3). */
const familiar = (m: Move) => (m.piece === "p" && "de".includes(m.from[0])) || (m.piece === "n" && "cf".includes(m.to[0]) && "36".includes(m.to[1])) || m.san.startsWith("O-O");

/** Light personality: centipawns of loss a bot will overlook for a move it likes. */
function liking(id: BotId, m: Move, opening: boolean): number {
  return (opening && familiar(m) ? 12 : 0) + flavour(id, m);
}

function flavour(id: BotId, m: Move): number {
  if (id === "pip") return m.captured ? 20 : 0;
  if (id === "cody") return m.piece === "k" ? 0 : centre(m.to) * 2;
  if (id === "rooky") return m.piece === "r" ? 10 : 0;
  if (id === "bishop") return m.piece === "b" ? 10 : 0;
  if (id === "ivy") return m.captured || /[+#]$/.test(m.san) ? 10 : 0;
  return 0;
}

/** The model's cap: a mate counts as 1000 centipawns, as in the Lichess data. */
const CAP = 1000;
const capped = (x: number) => Math.max(-CAP, Math.min(CAP, x));

/** The candidate whose loss against the best move is closest to `target` (ties go to what the bot likes). */
export function pickByLoss(ranked: readonly RankedMove[], target: number, like: (m: Move) => number, rand: () => number): Move {
  const best = capped(ranked[0].score);
  let pick = ranked[0].move;
  let closest = Infinity;
  for (const r of ranked) {
    const d = Math.abs(best - capped(r.score) - target) - like(r.move) + rand() * 6;
    if (d < closest) {
      closest = d;
      pick = r.move;
    }
  }
  return pick;
}

/**
 * Our quick search scores moves less sharply than the engine behind the Lichess evals, so the same
 * loss distribution plays closer to the middle. Self-play (scripts/bot-ladder.ts) showed the roster's
 * spread squeezed to a fraction of its targets; stretching around 1100 widens it again.
 */
export const modelRating = (rating: number) => 1100 + (rating - 1100) * 2.5;

const plyOf = (fen: string) => {
  const [, turn, , , , full] = fen.split(" ");
  return (Math.max(1, Number(full) || 1) - 1) * 2 + (turn === "b" ? 1 : 0);
};

/**
 * A bot's move, played like a person of `rating` (the bot's own unless adapted): the engine scores
 * every move, a centipawn loss is drawn from real games at that rating, phase and kind of position,
 * and the move nearest that loss is played. Phase 2 "gentle"/"steady" still work.
 */
export function chooseMove(fen: string, bot: BotId | LegacyLevel, rand: () => number = Math.random, rating?: number): Move | null {
  const id = toBotId(bot);
  const moves = load(fen).moves({ verbose: true });
  if (moves.length <= 1) return moves[0] ?? null;
  const r = modelRating(rating ?? botInfo(id).rating);
  // Below the data's floor (400), mix in moves a brand-new player might make.
  if (r < 400 && rand() < Math.min(0.9, (400 - r) / 700)) {
    const captures = moves.filter((m) => m.captured);
    return captures.length && rand() < 0.4 ? captures[Math.floor(rand() * captures.length)] : moves[Math.floor(rand() * moves.length)];
  }
  const ranked = rankMoves(fen, ENGINE[id]);
  const tactical = moves.some((m) => m.captured || /[+#]$/.test(m.san));
  const phase = phaseOf(fen.split(" ")[0], plyOf(fen));
  const target = sampleLoss(r, phase, tactical, rand);
  return pickByLoss(ranked, target, (m) => liking(id, m, phase === "opening"), rand);
}
