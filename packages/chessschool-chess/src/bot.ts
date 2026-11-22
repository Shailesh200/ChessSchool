import type { Move } from "chess.js";
import { rankMoves, type RankedMove } from "./engine";
import { load } from "./game";
import { sampleLoss } from "./mistakes";
import { phaseOf } from "./phase";

export type BotId = "pip" | "rooky" | "bishop" | "ivy" | "atlas" | "raja" | "cody";
/** @deprecated Phase 2 names, kept so saved games still load. */
export type LegacyLevel = "gentle" | "steady";
export type BotLevel = BotId;

export type BotInfo = {
  id: BotId;
  name: string;
  level: number;
  blurb: string;
  /** Rough level, in words, for players. */
  label: string;
  /** Rating on the chess.com scale: shown to players and used for their rating. Each learner's copy adapts around it. */
  rating: number;
  /** How hard it plays: the rating fed to the move model (our engine's own scale, higher than chess.com's). */
  strength: number;
  takebacks: boolean;
};

export const BOTS: readonly BotInfo[] = [
  // 0.7 roster: 7 bots, 300 to 2100 on the chess.com scale. Names follow the pieces, weakest to strongest; ids and ratings never change.
  { id: "pip", name: "Pip", level: 1, blurb: "Loves shiny captures, but rarely leaves a piece hanging.", label: "Beginner", rating: 300, strength: 1000, takebacks: true },
  { id: "rooky", name: "Sir Gallop", level: 2, blurb: "A cheerful knight who hops two moves ahead and guards his pieces.", label: "Novice", rating: 600, strength: 1250, takebacks: true },
  { id: "bishop", name: "Professor Bishop", level: 3, blurb: "Loves tricky diagonals and punishes loose pieces.", label: "Intermediate", rating: 900, strength: 1500, takebacks: true },
  { id: "ivy", name: "Rooky", level: 4, blurb: "Rolls down open files with sharp tactics. Calculates deeply.", label: "Club player", rating: 1200, strength: 1800, takebacks: false },
  { id: "atlas", name: "King Ivy", level: 5, blurb: "Tournament-strong. Very few mistakes.", label: "Strong club", rating: 1500, strength: 2050, takebacks: false },
  { id: "raja", name: "King Atlas", level: 6, blurb: "A royal strategist who almost never slips.", label: "Expert", rating: 1800, strength: 2300, takebacks: false },
  { id: "cody", name: "Chaukor", level: 7, blurb: "The school's champion. Plays like a master.", label: "Master", rating: 2100, strength: 2500, takebacks: false },
];
export type BotText = { name: string; blurb: string; label: string };
const BOT_TEXT_EN: Record<BotId, BotText> = Object.fromEntries(BOTS.map((b) => [b.id, { name: b.name, blurb: b.blurb, label: b.label }])) as Record<BotId, BotText>;
/** Puts the app language's bot names, bios and level words on BOTS (English when `text` is missing an entry). */
export function setBotText(text: Partial<Record<BotId, Partial<BotText>>>) {
  for (const b of BOTS) Object.assign(b, BOT_TEXT_EN[b.id], text[b.id] ?? {});
}
export const BOT_LEVELS: readonly BotId[] = BOTS.map((b) => b.id);
export const botInfo = (id: BotId) => BOTS.find((b) => b.id === id)!;
export const isBotId = (v: unknown): v is BotId => BOTS.some((b) => b.id === v);
/** Maps Phase 2 levels and unknown values onto the roster. */
export const toBotId = (v: unknown): BotId => (isBotId(v) ? v : v === "steady" ? "rooky" : "pip");

/** Search settings per bot; Ivy and Atlas think longer (up to ~2 s) so their low-loss moves are really good. */
const ENGINE: Record<BotId, { depth: number; quiescence: number; timeMs: number }> = {
  pip: { depth: 3, quiescence: 4, timeMs: 500 },
  rooky: { depth: 3, quiescence: 4, timeMs: 700 },
  bishop: { depth: 4, quiescence: 5, timeMs: 1200 },
  ivy: { depth: 5, quiescence: 6, timeMs: 1500 },
  atlas: { depth: 5, quiescence: 7, timeMs: 1800 },
  raja: { depth: 6, quiescence: 8, timeMs: 2000 },
  cody: { depth: 6, quiescence: 9, timeMs: 2200 },
};

/**
 * Lesson games ask for "gentle" or "steady": they keep the easy strengths the Gym bots had before 0.7
 * (when the Gym bots each moved up two levels), so a child's first in-lesson games stay friendly.
 */
const LESSON: Record<LegacyLevel, { like: BotId; rating: number; engine: { depth: number; quiescence: number; timeMs: number } }> = {
  gentle: { like: "cody", rating: 700, engine: { depth: 2, quiescence: 3, timeMs: 350 } },
  steady: { like: "rooky", rating: 1000, engine: { depth: 3, quiescence: 4, timeMs: 500 } },
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
  return nearestByLoss(ranked, target, like, rand, 1)[0]!;
}

/** The `n` candidates whose loss is closest to `target`, closest first. */
function nearestByLoss(ranked: readonly RankedMove[], target: number, like: (m: Move) => number, rand: () => number, n: number): Move[] {
  const best = capped(ranked[0].score);
  return ranked
    .map((r) => ({ move: r.move, d: Math.abs(best - capped(r.score) - target) - like(r.move) + rand() * 6 }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map((x) => x.move);
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
  return botOptions(fen, bot, rand, rating, 1)[0] ?? null;
}

/**
 * The `n` moves nearest the drawn loss, best fit first (the first is `chooseMove`'s pick). The AI bot
 * chooses among these in its own style, so it still plays at its rating.
 */
export function botOptions(fen: string, bot: BotId | LegacyLevel, rand: () => number = Math.random, rating?: number, n = 4): Move[] {
  const lesson = bot === "gentle" || bot === "steady" ? LESSON[bot] : null;
  const id = lesson?.like ?? toBotId(bot);
  const moves = load(fen).moves({ verbose: true });
  if (moves.length <= 1) return moves;
  // `rating` is the learner's adapted copy on the chess.com scale: move the bot's strength by the same amount.
  const info = botInfo(id);
  const r = modelRating(lesson ? lesson.rating : info.strength + (rating === undefined ? 0 : rating - info.rating));
  // Below the data's floor (400), mix in moves a brand-new player might make.
  if (r < 400 && rand() < Math.min(0.9, (400 - r) / 700)) {
    const captures = moves.filter((m) => m.captured);
    return [captures.length && rand() < 0.4 ? captures[Math.floor(rand() * captures.length)] : moves[Math.floor(rand() * moves.length)]];
  }
  const ranked = rankMoves(fen, lesson?.engine ?? ENGINE[id]);
  const tactical = moves.some((m) => m.captured || /[+#]$/.test(m.san));
  const phase = phaseOf(fen.split(" ")[0], plyOf(fen));
  const target = sampleLoss(r, phase, tactical, rand);
  return nearestByLoss(ranked, target, (m) => liking(id, m, phase === "opening"), rand, n);
}
