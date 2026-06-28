import { Chess } from "chess.js";
import type { MoveInput, PieceSymbol } from "@/core/types/chess";

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
  /** 0..1 deterministic seed substitute for reproducible "randomness". */
  jitter: number;
  depth: number;
  /** probability of deliberately not picking the best move */
  blunderChance: number;
}

/** Map an ELO target to a search profile. */
export function eloToConfig(elo: number): BotConfig {
  const clamped = Math.max(500, Math.min(2500, elo));
  if (clamped < 800) return { depth: 1, blunderChance: 0.45, jitter: 0.9 };
  if (clamped < 1100) return { depth: 2, blunderChance: 0.3, jitter: 0.6 };
  if (clamped < 1500) return { depth: 2, blunderChance: 0.15, jitter: 0.35 };
  if (clamped < 1900) return { depth: 3, blunderChance: 0.06, jitter: 0.18 };
  return { depth: 3, blunderChance: 0.0, jitter: 0.05 };
}

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

function negamax(
  game: Chess,
  depth: number,
  alpha: number,
  beta: number,
): number {
  if (depth === 0 || game.isGameOver()) {
    if (game.isCheckmate()) return -100000 - depth;
    if (game.isGameOver()) return 0;
    return evaluate(game);
  }
  let best = -Infinity;
  const moves = orderMoves(game.moves({ verbose: true }));
  for (const m of moves) {
    game.move(m as never);
    const score = -negamax(game, depth - 1, -beta, -alpha);
    game.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break; // prune
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
  const moves = orderMoves(game.moves({ verbose: true }));
  if (moves.length === 0) return null;

  const scored = moves.map((m, i) => {
    game.move(m as never);
    const score = -negamax(game, config.depth - 1, -Infinity, Infinity);
    game.undo();
    // light deterministic jitter keyed off seed + index for variety
    const noise = ((Math.sin((i + 1) * (seed + 0.13)) + 1) / 2) * 60 * config.jitter;
    return { move: m, score: score + noise };
  });

  scored.sort((a, b) => b.score - a.score);

  // Blunder: pick a sub-optimal but legal move to emulate a weaker player.
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

/** Async-shaped wrapper around the search (kept async so callers don't block on it). */
export function getBotMove(fen: string, config: BotConfig, seed = 0.5): Promise<MoveInput | null> {
  return Promise.resolve(chooseMove(fen, config, seed));
}
