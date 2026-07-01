import { Chess } from "chess.js";
import type { MoveInput, PieceSymbol } from "../types/chess";

/**
 * Adaptive bot — negamax + alpha-beta with piece-square tables.
 *
 * Fully offline, dependency-light. ELO (500–2500) maps to search depth and a
 * "blunder" probability so lower-rated bots feel genuinely beatable rather than
 * just slow. A {@link StockfishAdapter}-shaped seam lets a real engine drop in.
 */

const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

// Midgame piece-square tables (white POV; mirrored for black).
const PST: Record<PieceSymbol, number[]> = {
  p: [
    0, 0, 0, 0, 0, 0, 0, 0, 50, 50, 50, 50, 50, 50, 50, 50, 10, 10, 20, 30, 30,
    20, 10, 10, 5, 5, 10, 25, 25, 10, 5, 5, 0, 0, 0, 20, 20, 0, 0, 0, 5, -5, -10,
    0, 0, -10, -5, 5, 5, 10, 10, -20, -20, 10, 10, 5, 0, 0, 0, 0, 0, 0, 0, 0,
  ],
  n: [
    -50, -40, -30, -30, -30, -30, -40, -50, -40, -20, 0, 0, 0, 0, -20, -40, -30,
    0, 10, 15, 15, 10, 0, -30, -30, 5, 15, 20, 20, 15, 5, -30, -30, 0, 15, 20,
    20, 15, 0, -30, -30, 5, 10, 15, 15, 10, 5, -30, -40, -20, 0, 5, 5, 0, -20,
    -40, -50, -40, -30, -30, -30, -30, -40, -50,
  ],
  b: [
    -20, -10, -10, -10, -10, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0,
    5, 10, 10, 5, 0, -10, -10, 5, 5, 10, 10, 5, 5, -10, -10, 0, 10, 10, 10, 10,
    0, -10, -10, 10, 10, 10, 10, 10, 10, -10, -10, 5, 0, 0, 0, 0, 5, -10, -20,
    -10, -10, -10, -10, -10, -10, -20,
  ],
  r: [
    0, 0, 0, 0, 0, 0, 0, 0, 5, 10, 10, 10, 10, 10, 10, 5, -5, 0, 0, 0, 0, 0, 0,
    -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0, -5, -5, 0, 0, 0, 0, 0, 0,
    -5, -5, 0, 0, 0, 0, 0, 0, -5, 0, 0, 0, 5, 5, 0, 0, 0,
  ],
  q: [
    -20, -10, -10, -5, -5, -10, -10, -20, -10, 0, 0, 0, 0, 0, 0, -10, -10, 0, 5,
    5, 5, 5, 0, -10, -5, 0, 5, 5, 5, 5, 0, -5, 0, 0, 5, 5, 5, 5, 0, -5, -10, 5,
    5, 5, 5, 5, 0, -10, -10, 0, 5, 0, 0, 0, 0, -10, -20, -10, -10, -5, -5, -10,
    -10, -20,
  ],
  k: [
    -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40, -40,
    -30, -30, -40, -40, -50, -50, -40, -40, -30, -30, -40, -40, -50, -50, -40,
    -40, -30, -20, -30, -30, -40, -40, -30, -30, -20, -10, -20, -20, -20, -20,
    -20, -20, -10, 20, 20, 0, 0, 0, 0, 20, 20, 20, 30, 10, 0, 0, 10, 30, 20,
  ],
};

export interface BotConfig {
  /** the (clamped) target ELO — drives Stockfish strength */
  elo: number;
  /** 0..1 deterministic seed substitute for reproducible "randomness". */
  jitter: number;
  depth: number;
  /** probability of deliberately not picking the best move */
  blunderChance: number;
}

/** Map an ELO target to a search profile. Depth is the *full-width* depth; a
 * quiescence search always extends captures on top, so even depth 2 plays
 * tactically sound chess (no horizon-effect hangs). */
export function eloToConfig(elo: number): BotConfig {
  const clamped = Math.max(300, Math.min(2500, elo));
  if (clamped < 500) return { elo: clamped, depth: 1, blunderChance: 0.6, jitter: 1 }; // beginner — frequent mistakes, but legal/sane moves
  if (clamped < 800) return { elo: clamped, depth: 2, blunderChance: 0.4, jitter: 0.6 };
  if (clamped < 1100) return { elo: clamped, depth: 2, blunderChance: 0.22, jitter: 0.4 };
  if (clamped < 1500) return { elo: clamped, depth: 2, blunderChance: 0.1, jitter: 0.25 };
  if (clamped < 1900) return { elo: clamped, depth: 3, blunderChance: 0.03, jitter: 0.12 };
  return { elo: clamped, depth: 3, blunderChance: 0.0, jitter: 0.04 };
}

// Tiny opening book so the bot opens like a human instead of a depth-2 search.
const OPENING_BOOK: Record<string, string[]> = {
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1": ["e2e4", "d2d4", "g1f3", "c2c4"],
  "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1": ["c7c5", "e7e5", "e7e6", "c7c6"],
  "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1": ["g8f6", "d7d5"],
  "rnbqkbnr/pppppppp/8/8/2P5/8/PP1PPPPP/RNBQKBNR b KQkq - 0 1": ["e7e5", "g8f6", "c7c5"],
  "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2": ["g1f3", "c2c3", "b1c3"],
};
const NODE_CAP = 2800; // chess.js is slow per node; this keeps a "think" ~1s (phones ~1.5–2s)
const QMAX = 2; // shallow quiescence (resolve immediate recaptures) — bounds explosion

function evaluate(game: Chess): number {
  // Positive = good for side to move.
  const board = game.board();
  let score = 0;
  for (let r = 0; r < 8; r++) {
    const row = board[r];
    if (!row) continue;
    for (let f = 0; f < 8; f++) {
      const cell = row[f];
      if (!cell) continue;
      const idx = r * 8 + f;
      const mirror = (7 - r) * 8 + f;
      const base = PIECE_VALUE[cell.type as PieceSymbol];
      const table = PST[cell.type as PieceSymbol];
      const pst = cell.color === "w" ? (table[idx] ?? 0) : (table[mirror] ?? 0);
      score += cell.color === "w" ? base + pst : -(base + pst);
    }
  }
  return game.turn() === "w" ? score : -score;
}

const ORDER_VAL: Record<string, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };

/** Move ordering (MVV-LVA + promotions/checks first) → much tighter pruning. */
function orderMoves<T extends { captured?: string; piece: string; promotion?: string; san?: string }>(moves: T[]): T[] {
  return moves
    .map((m) => {
      let s = 0;
      if (m.captured) s += 10 * (ORDER_VAL[m.captured] ?? 0) - (ORDER_VAL[m.piece] ?? 0);
      if (m.promotion) s += 8;
      if (m.san?.includes("+")) s += 1;
      return { m, s };
    })
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

/**
 * Quiescence search — at a leaf, keep searching *captures* (and promotions)
 * until the position is quiet, so the static eval is never taken in the middle
 * of an exchange. This is what removes the horizon-effect blunders.
 */
function quiesce(game: Chess, alpha: number, beta: number, nodes: { n: number }, qply: number): number {
  const stand = evaluate(game);
  if (stand >= beta) return beta;
  if (stand > alpha) alpha = stand;
  if (qply <= 0 || nodes.n > NODE_CAP) return alpha;
  const caps = orderMoves(game.moves({ verbose: true }).filter((m) => m.captured || m.promotion));
  for (const m of caps) {
    nodes.n++;
    game.move(m as never);
    const score = -quiesce(game, -beta, -alpha, nodes, qply - 1);
    game.undo();
    if (score >= beta) return beta;
    if (score > alpha) alpha = score;
  }
  return alpha;
}

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
  nodes: { n: number },
): number {
  if (game.isGameOver()) {
    if (game.isCheckmate()) return -100000 - depth; // prefer faster mates
    return 0; // stalemate / draw
  }
  if (nodes.n > NODE_CAP) return evaluate(game); // hard budget guard — bail with static eval
  if (depth === 0) return quiesce(game, alpha, beta, nodes, QMAX);
  let best = -Infinity;
  const moves = orderMoves(game.moves({ verbose: true }));
  for (const m of moves) {
    nodes.n++;
    game.move(m as never);
    const score = -negamax(game, depth - 1, -beta, -alpha, nodes);
    game.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // prune
    if (nodes.n > NODE_CAP) break;
  }
  return best;
}

/** Pick a move for the side to move given a FEN. Pseudo-random via `seed`. */
export function chooseMove(
  fen: string,
  config: BotConfig,
  seed = 0.5,
): MoveInput | null {
  const game = new Chess(fen);
  const legal = game.moves({ verbose: true });
  if (legal.length === 0) return null;

  // Opening book — open like a human rather than a shallow search.
  const book = OPENING_BOOK[fen];
  if (book) {
    const candidates = book.filter((uci) => legal.some((m) => `${m.from}${m.to}` === uci));
    if (candidates.length) {
      const m = legal.find((x) => `${x.from}${x.to}` === candidates[Math.floor(seed * candidates.length) % candidates.length])!;
      return { from: m.from, to: m.to, promotion: (m.promotion as PieceSymbol | undefined) ?? undefined };
    }
  }

  let moves = orderMoves(legal);
  const nodes = { n: 0 };
  let scored: { move: (typeof legal)[number]; score: number }[] = moves.map((m) => ({ move: m, score: 0 }));

  // Iterative deepening: each *completed* depth refines the scores and re-orders
  // moves best-first for sharper pruning next time. If the node budget runs out
  // mid-iteration we keep the last fully-searched depth's result — so the move is
  // always sound and the "think" is bounded (responsive on a phone).
  for (let d = 1; d <= config.depth; d++) {
    const partial: { move: (typeof legal)[number]; score: number }[] = [];
    let aborted = false;
    for (const m of moves) {
      game.move(m as never);
      const s = -negamax(game, d - 1, -Infinity, Infinity, nodes);
      game.undo();
      partial.push({ move: m, score: s });
      if (nodes.n > NODE_CAP) { aborted = true; break; }
    }
    if (!aborted) {
      partial.sort((a, b) => b.score - a.score);
      scored = partial;
      moves = scored.map((x) => x.move);
    }
    if (aborted) break;
  }

  // tiny deterministic tie-break (≤4cp) so near-equal positions vary a little
  scored = scored
    .map((x, i) => ({ move: x.move, score: x.score + ((Math.sin((i + 1) * (seed + 0.13)) + 1) / 2) * 4 * config.jitter }))
    .sort((a, b) => b.score - a.score);

  // Weakness model: with blunderChance pick a sub-optimal — but still searched,
  // sane — move from the top few, instead of injecting random noise everywhere.
  const pickIndex =
    seed < config.blunderChance && scored.length > 2
      ? 1 + Math.floor(seed * Math.min(3, scored.length - 1))
      : 0;
  const chosen = scored[pickIndex] ?? scored[0];
  if (!chosen) return null;
  return {
    from: chosen.move.from,
    to: chosen.move.to,
    promotion: (chosen.move.promotion as PieceSymbol | undefined) ?? undefined,
  };
}

/** A platform Stockfish adapter: returns a best move for (fen, elo) or null. */
export type EngineAdapter = (fen: string, elo: number) => Promise<MoveInput | null>;

/**
 * Best move for the bot. If a platform engine adapter is supplied (web Worker,
 * mobile WebView/native), it's used for ELO ≥ 800; otherwise — and on any
 * failure — falls back to the in-house JS search so play never breaks.
 */
export async function getBotMove(
  fen: string,
  config: BotConfig,
  seed = 0.5,
  engine?: EngineAdapter,
): Promise<MoveInput | null> {
  if (engine && config.elo >= 800) {
    try {
      const m = await engine(fen, config.elo);
      if (m) return m;
    } catch {
      /* fall through to the JS engine */
    }
  }
  return chooseMove(fen, config, seed);
}
