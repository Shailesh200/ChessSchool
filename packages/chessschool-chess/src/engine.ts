import type { Chess, Move } from "chess.js";
import { load } from "./game";

/**
 * Alpha-beta search for Cody's stronger bots. It uses chess.js's internal move list and make/undo
 * (pinned to chess.js 1.4) because the public `move()` re-validates every call and is ~10x slower.
 */
type IMove = { color: "w" | "b"; from: number; to: number; piece: string; captured?: string; promotion?: string; flags: number };
type Fast = {
  _moves(o: { legal: boolean }): IMove[];
  _makeMove(m: IMove): void;
  _undoMove(): unknown;
  _board: ({ type: string; color: "w" | "b" } | undefined)[];
  _turn: "w" | "b";
  _isKingAttacked(color: "w" | "b"): boolean;
  _hash: bigint;
};
const fastOf = (c: Chess) => {
  const f = c as unknown as Fast;
  return typeof f._moves === "function" && typeof f._makeMove === "function" && typeof f._undoMove === "function" && Array.isArray(f._board) ? f : null;
};

export const VALUE: Record<string, number> = { p: 100, n: 310, b: 320, r: 500, q: 900, k: 0 };
const MATE = 100_000;

/** Beginner principles: centre pawns forward, knights and bishops out, king stays home. */
export function placement(type: string, color: "w" | "b", file: number, rank: number): number {
  const home = color === "w" ? 0 : 7;
  const centre = 6 - (Math.abs(3.5 - file) + Math.abs(3.5 - rank));
  if (type === "p") {
    const advance = Math.min(3, color === "w" ? rank - 1 : 6 - rank);
    const far = color === "w" ? rank : 7 - rank;
    const runner = far >= 5 ? (far - 4) * 25 : 0;
    return runner + (file === 3 || file === 4 ? advance * 10 : file === 2 || file === 5 ? advance * 3 : file >= 6 ? -advance * 4 : 0);
  }
  if (type === "n" || type === "b") return centre * 4 + (rank === home ? 0 : 14);
  if (type === "q") return centre * 1;
  if (type === "k") return rank === home ? 12 : -10;
  return 0;
}

/** Static score from the side to move's point of view. */
function evaluate(f: Fast): number {
  let score = 0;
  for (let sq = 0; sq < 128; sq++) {
    if (sq & 0x88) {
      sq += 7;
      continue;
    }
    const p = f._board[sq];
    if (!p) continue;
    const v = VALUE[p.type] + placement(p.type, p.color, sq & 0xf, 7 - (sq >> 4));
    score += p.color === f._turn ? v : -v;
  }
  return score;
}

const order = (moves: IMove[]) => moves.sort((a, b) => (b.captured ? VALUE[b.captured] * 10 - VALUE[b.piece] : 0) + (b.promotion ? 800 : 0) - ((a.captured ? VALUE[a.captured] * 10 - VALUE[a.piece] : 0) + (a.promotion ? 800 : 0)));

class Timeout extends Error {}

function search(f: Fast, deadline: number) {
  let nodes = 0;
  const tick = () => {
    if (++nodes % 512 === 0 && Date.now() > deadline) throw new Timeout();
  };
  // Two quiet moves per ply that cut off a sibling: tried right after the captures.
  const killers: string[][] = [];
  const key = (m: IMove) => `${m.from}-${m.to}`;
  // The best move found here by a shallower search (iterative deepening) is tried first.
  const hashMove = new Map<bigint, string>();
  const orderAt = (moves: IMove[], ply: number) => {
    const k = killers[ply] ?? [];
    const h = hashMove.get(f._hash);
    const score = (m: IMove) => (h === key(m) ? 100_000 : m.captured ? VALUE[m.captured] * 10 - VALUE[m.piece] + 10_000 : m.promotion ? 9_000 : k.includes(key(m)) ? 5_000 : 0);
    return moves.sort((a, b) => score(b) - score(a));
  };
  // Moves are generated pseudo-legal and checked only when searched: at a cut-off most siblings are never made.
  const make = (m: IMove) => {
    const us = f._turn;
    f._makeMove(m);
    if (!f._isKingAttacked(us)) return true;
    f._undoMove();
    return false;
  };
  const quiesce = (alpha: number, beta: number, depth: number): number => {
    tick();
    const stand = evaluate(f);
    if (depth === 0) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;
    for (const m of order(f._moves({ legal: false }).filter((x) => x.captured || x.promotion))) {
      if (!make(m)) continue;
      const score = -quiesce(-beta, -alpha, depth - 1);
      f._undoMove();
      if (score >= beta) return score;
      if (score > alpha) alpha = score;
    }
    return alpha;
  };
  const negamax = (depth: number, alpha: number, beta: number, ply: number, q: number): number => {
    tick();
    if (depth === 0) {
      // A mate still counts at the horizon (a stalemate there is left to the next search).
      if (f._isKingAttacked(f._turn) && !f._moves({ legal: true }).length) return -MATE + ply;
      return quiesce(alpha, beta, q);
    }
    let best = -Infinity;
    let bestKey = "";
    let any = false;
    const here = f._hash;
    for (const m of orderAt(f._moves({ legal: false }), ply)) {
      if (!make(m)) continue;
      any = true;
      const score = -negamax(depth - 1, -beta, -alpha, ply + 1, q);
      f._undoMove();
      if (score > best) {
        best = score;
        bestKey = key(m);
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!m.captured) killers[ply] = [key(m), ...(killers[ply] ?? []).filter((x) => x !== key(m))].slice(0, 2);
        break;
      }
    }
    if (!any) return f._isKingAttacked(f._turn) ? -MATE + ply : 0;
    if (hashMove.size < 200_000) hashMove.set(here, bestKey);
    return best;
  };
  return { negamax };
}

export type SearchOptions = { depth: number; quiescence: number; timeMs: number; noise: number };

/** Best move by iterative deepening up to `depth`, stopping at the time budget. */
export function bestMove(fen: string, opts: SearchOptions, rand: () => number = Math.random): Move | null {
  const chess = load(fen);
  const legal = chess.moves({ verbose: true });
  if (!legal.length) return null;
  const f = fastOf(chess);
  if (!f) return legal[0];
  const deadline = Date.now() + opts.timeMs;
  const { negamax } = search(f, deadline);
  const roots = order(f._moves({ legal: true }));
  let chosen = roots[0];
  for (let depth = 1; depth <= opts.depth; depth++) {
    try {
      let bestScore = -Infinity;
      let bestAtDepth = chosen;
      // Search the previous best first so a timeout still leaves a good answer.
      const list = [chosen, ...roots.filter((m) => m !== chosen)];
      for (const m of list) {
        f._makeMove(m);
        let score: number;
        try {
          score = -negamax(depth - 1, -Infinity, -bestScore + opts.noise, 1, opts.quiescence);
        } finally {
          f._undoMove();
        }
        score += rand() * opts.noise;
        if (score > bestScore) {
          bestScore = score;
          bestAtDepth = m;
        }
      }
      chosen = bestAtDepth;
      if (bestScore > MATE / 2) break;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  const sq = (i: number) => `${"abcdefgh"[i & 0xf]}${8 - (i >> 4)}`;
  return legal.find((m) => m.from === sq(chosen.from) && m.to === sq(chosen.to) && (m.promotion ?? "") === (chosen.promotion ?? "")) ?? legal[0];
}

export type RankedMove = { move: Move; score: number };

/**
 * Every root move with its score (centipawns, side to move), best first, from the deepest search
 * that finished inside the time budget. Moves more than `floor` below the best only get an upper bound.
 */
export function rankMoves(fen: string, opts: { depth: number; quiescence: number; timeMs: number; floor?: number }): RankedMove[] {
  const chess = load(fen);
  const legal = chess.moves({ verbose: true });
  const f = fastOf(chess);
  if (!legal.length || !f) return legal.map((move) => ({ move, score: 0 }));
  const floor = opts.floor ?? 1000;
  const { negamax } = search(f, Date.now() + opts.timeMs);
  let ranked = order(f._moves({ legal: true })).map((m) => ({ m, score: 0 }));
  for (let depth = 1; depth <= opts.depth; depth++) {
    try {
      let best = -Infinity;
      const next = ranked.map(({ m }) => {
        f._makeMove(m);
        try {
          const score = -negamax(depth - 1, -Infinity, -(best - floor), 1, opts.quiescence);
          best = Math.max(best, score);
          return { m, score };
        } finally {
          f._undoMove();
        }
      });
      ranked = next.sort((a, b) => b.score - a.score);
      if (ranked[0].score > MATE / 2) break;
    } catch (e) {
      if (!(e instanceof Timeout)) throw e;
      break;
    }
  }
  const sq = (i: number) => `${"abcdefgh"[i & 0xf]}${8 - (i >> 4)}`;
  return ranked.map(({ m, score }) => ({ move: legal.find((x) => x.from === sq(m.from) && x.to === sq(m.to) && (x.promotion ?? "") === (m.promotion ?? ""))!, score }));
}

/** Quick score (centipawns, side to move) for game review. */
export function quickEval(fen: string): number {
  const chess = load(fen);
  const f = fastOf(chess);
  if (!f) return 0;
  const { negamax } = search(f, Date.now() + 400);
  try {
    return negamax(1, -Infinity, Infinity, 0, 3);
  } catch (e) {
    if (!(e instanceof Timeout)) throw e;
    // A timeout leaves moves made deep in the search: score a fresh copy of the position, not that board.
    return evaluate(fastOf(load(fen))!);
  }
}
