import type { RateInput } from "./api";
import type { GameRecord, LocalState } from "./progress";

/**
 * The learner's playing rating (Glicko-2, one result per rating period) and each bot's adaptive
 * strength. Shared by the apps (offline mirror) and the API (the source of truth for accounts).
 */
export type Glicko = { rating: number; rd: number; vol: number };
/**
 * `best`: the highest rating reached. `bestWin`: the strongest bot beaten (its rating then).
 * `upset`: the biggest gap won against a stronger bot. All three are absent until they happen.
 */
export type Ratings = { player: Glicko & { games: number }; bots: Record<string, number>; best?: number; bestWin?: number; upset?: number };

export const emptyRatings = (): Ratings => ({ player: { rating: 800, rd: 350, vol: 0.06, games: 0 }, bots: {} });

const SCALE = 173.7178;
const TAU = 0.5;

/** Glicko-2 (Glickman 2012) for one rating period. */
export function glicko2(p: Glicko, results: readonly { rating: number; rd: number; score: number }[]): Glicko {
  const phi = p.rd / SCALE;
  if (!results.length) return { ...p, rd: Math.min(350, Math.sqrt(phi * phi + p.vol * p.vol) * SCALE) };
  const mu = (p.rating - 1500) / SCALE;
  const g = (ph: number) => 1 / Math.sqrt(1 + (3 * ph * ph) / (Math.PI * Math.PI));
  let vInv = 0;
  let sum = 0;
  for (const o of results) {
    const gj = g(o.rd / SCALE);
    const e = 1 / (1 + Math.exp(-gj * (mu - (o.rating - 1500) / SCALE)));
    vInv += gj * gj * e * (1 - e);
    sum += gj * (o.score - e);
  }
  const v = 1 / vInv;
  const delta = v * sum;
  const a = Math.log(p.vol * p.vol);
  const f = (x: number) => (Math.exp(x) * (delta * delta - phi * phi - v - Math.exp(x))) / (2 * (phi * phi + v + Math.exp(x)) ** 2) - (x - a) / (TAU * TAU);
  let A = a;
  let B: number;
  if (delta * delta > phi * phi + v) B = Math.log(delta * delta - phi * phi - v);
  else {
    let k = 1;
    while (f(a - k * TAU) < 0) k++;
    B = a - k * TAU;
  }
  let fA = f(A);
  let fB = f(B);
  while (Math.abs(B - A) > 1e-6) {
    const C = A + ((A - B) * fA) / (fB - fA);
    const fC = f(C);
    if (fC * fB <= 0) {
      A = B;
      fA = fB;
    } else fA /= 2;
    B = C;
    fB = fC;
  }
  const vol = Math.exp(A / 2);
  const star = Math.sqrt(phi * phi + vol * vol);
  const phi2 = 1 / Math.sqrt(1 / (star * star) + 1 / v);
  return { rating: SCALE * (mu + phi2 * phi2 * sum) + 1500, rd: SCALE * phi2, vol };
}

/** The share of recent games we want the learner to win against each bot. */
export const ADAPT_TARGET = 0.575;
/** A bot drifts at most this far from its own rating. */
export const ADAPT_RANGE = 300;
const ADAPT_STEP = 64;

/**
 * After a game, the bot gets a little stronger when the learner scored above the target and weaker
 * below it, so over recent games the learner wins about 55–60%.
 */
export function nudgeBot(current: number, target: number, score: number): number {
  const next = current + ADAPT_STEP * (score - ADAPT_TARGET);
  return Math.round(Math.max(Math.max(100, target - ADAPT_RANGE), Math.min(target + ADAPT_RANGE, next)));
}

/** The bot's current (adapted) rating for this learner. */
export const botRatingOf = (r: Ratings, bot: string, target: number) => r.bots[bot] ?? target;

export type RatedResult = { kind: "bot"; bot: string; target: number; score: 0 | 0.5 | 1 } | { kind: "puzzle"; puzzleRating: number; solved: boolean };

const BOT_RD = 50;
const PUZZLE_RD = 80;

/** One bot game or puzzle: updates the learner's rating and, for a bot, that bot's strength. */
export function applyResult(r: Ratings, e: RatedResult): Ratings {
  const opp = e.kind === "bot" ? { rating: botRatingOf(r, e.bot, e.target), rd: BOT_RD, score: e.score } : { rating: e.puzzleRating, rd: PUZZLE_RD, score: e.solved ? 1 : 0 };
  const next = glicko2(r.player, [opp]);
  const player = { rating: Math.round(Math.max(100, Math.min(3000, next.rating))), rd: Math.round(Math.max(30, Math.min(350, next.rd)) * 10) / 10, vol: Math.min(0.2, next.vol), games: r.player.games + 1 };
  const won = e.kind === "bot" && e.score === 1;
  const gap = Math.round(opp.rating - r.player.rating);
  return {
    player,
    bots: e.kind === "bot" ? { ...r.bots, [e.bot]: nudgeBot(opp.rating, e.target, e.score) } : r.bots,
    best: Math.max(r.best ?? r.player.rating, player.rating),
    ...(won || r.bestWin !== undefined ? { bestWin: Math.max(r.bestWin ?? 0, won ? Math.round(opp.rating) : 0) } : {}),
    ...(won && gap > 0 ? { upset: Math.max(r.upset ?? 0, gap) } : r.upset !== undefined ? { upset: r.upset } : {}),
  };
}

/** Accepts anything (storage, API) and returns valid ratings. */
export function sanitizeRatings(raw: unknown): Ratings {
  const base = emptyRatings();
  if (!raw || typeof raw !== "object") return base;
  const r = raw as Partial<Ratings>;
  const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === "number" && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d);
  const p = (r.player ?? {}) as Partial<Ratings["player"]>;
  const bots: Record<string, number> = {};
  for (const [id, v] of Object.entries(r.bots && typeof r.bots === "object" ? r.bots : {})) if (/^[a-z]{1,16}$/.test(id) && typeof v === "number" && Number.isFinite(v)) bots[id] = Math.round(Math.max(100, Math.min(3000, v)));
  const peak = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? { v: Math.round(Math.max(0, Math.min(3000, v))) } : null);
  const best = peak(r.best);
  const bestWin = peak(r.bestWin);
  const upset = peak(r.upset);
  return {
    player: { rating: Math.round(num(p.rating, 100, 3000, base.player.rating)), rd: num(p.rd, 30, 350, base.player.rd), vol: num(p.vol, 0.01, 0.2, base.player.vol), games: Math.floor(num(p.games, 0, 1e7, 0)) },
    bots,
    ...(best ? { best: best.v } : {}),
    ...(bestWin ? { bestWin: bestWin.v } : {}),
    ...(upset ? { upset: upset.v } : {}),
  };
}

/** A finished bot game as a rated result (null for pass & play or a game with no moves). */
export function ratedGame(game: GameRecord, target: number): { input: RateInput; result: RatedResult } | null {
  if (game.setup.opponent.kind !== "bot" || !game.history.length) return null;
  const bot = game.setup.opponent.bot;
  const score = game.winner === null ? 0.5 : game.winner === game.setup.you ? 1 : 0;
  const result = score === 1 ? "win" : score === 0 ? "loss" : "draw";
  return { input: { kind: "bot", event: game.id, bot, result, moves: game.history.length }, result: { kind: "bot", bot, target, score } };
}

/** A puzzle attempt as a rated result; `at` makes each attempt its own event. */
export function ratedPuzzle(p: { id: string; solved: boolean; puzzleRating: number }, at: number): { input: RateInput; result: RatedResult } {
  return { input: { kind: "puzzle", event: `${p.id}-${at}`.slice(-80), puzzle: p.id, puzzleRating: p.puzzleRating, solved: p.solved }, result: { kind: "puzzle", puzzleRating: p.puzzleRating, solved: p.solved } };
}

/* ---------- results waiting to reach the server ---------- */

const learnerOf = (q: RateInput) => q.child ?? null;

/** Counts a result on the device now and queues it for the server (sent in order; the server dedupes by event). */
export function queueRating(s: LocalState, rated: { input: RateInput; result: RatedResult }): LocalState {
  const input = s.activeChild ? { ...rated.input, child: s.activeChild } : rated.input;
  return { ...s, ratings: applyResult(s.ratings, rated.result), ratingQueue: [...s.ratingQueue, input].slice(-RATING_QUEUE_MAX) };
}

/** Server ratings for a learner replace the device's copy only when nothing of theirs is still unsent. */
export function adoptRatings(s: LocalState, learner: string | null, ratings: unknown): LocalState {
  if (s.activeChild !== learner || s.ratingQueue.some((q) => learnerOf(q) === learner)) return s;
  const next = sanitizeRatings(ratings);
  // Older server rows have no peaks: keep the higher of the device's and the server's.
  const peak = (k: "best" | "bestWin" | "upset") => {
    const v = Math.max(next[k] ?? -1, s.ratings[k] ?? -1);
    return v >= 0 ? { [k]: v } : {};
  };
  return { ...s, ratings: { ...next, ...peak("best"), ...peak("bestWin"), ...peak("upset") } };
}

/** One queued result reached the server (or was refused for good, with no ratings to adopt). */
export function ratingSent(s: LocalState, sent: RateInput, ratings?: unknown): LocalState {
  const next = { ...s, ratingQueue: s.ratingQueue.filter((q) => !(q.event === sent.event && learnerOf(q) === learnerOf(sent))) };
  return ratings === undefined ? next : adoptRatings(next, learnerOf(sent), ratings);
}

export const RATING_QUEUE_MAX = 100;

export function sanitizeRatingQueue(raw: unknown): RateInput[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((q): q is RateInput => Boolean(q && typeof q === "object" && typeof q.event === "string" && (q.kind === "bot" || q.kind === "puzzle"))).slice(-RATING_QUEUE_MAX);
}
