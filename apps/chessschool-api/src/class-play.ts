import { load, outcome, tryMove, type Square } from "@chessschool/chess";
import { START_FEN, type ClassGameReason, type ClassGameResult } from "@chessschool/design";
import type { Chess } from "chess.js";

/** Class games are stored as space-separated SAN from the normal start position. */
export const splitMoves = (moves: string) => (moves ? moves.split(" ") : []);

export function replay(moves: string): Chess {
  const chess = load(START_FEN);
  for (const san of splitMoves(moves)) chess.move(san);
  return chess;
}

export type MoveOutcome = { moves: string; over: { result: ClassGameResult; reason: ClassGameReason } | null };

/** Plays one move on a stored game. Null when the move is not legal in that position. */
export function playMove(moves: string, from: string, to: string, promotion?: string): MoveOutcome | null {
  const chess = replay(moves);
  const piece = promotion === "r" || promotion === "b" || promotion === "n" ? promotion : "q";
  let played;
  try {
    played = tryMove(chess, from as Square, to as Square, piece);
  } catch {
    return null;
  }
  if (!played) return null;
  const next = moves ? `${moves} ${played.san}` : played.san;
  const end = outcome(chess);
  if (!end) return { moves: next, over: null };
  if (end.kind === "checkmate") return { moves: next, over: { result: end.winner === "w" ? "1-0" : "0-1", reason: "checkmate" } };
  return { moves: next, over: { result: "1/2-1/2", reason: end.kind } };
}

/** Every pairing of a round robin (circle method), round by round; white goes to whoever has had it less. */
export function roundRobin(players: string[]): [white: string, black: string][] {
  const ring: (string | null)[] = players.length % 2 ? [...players, null] : [...players];
  const n = ring.length;
  const whites = new Map<string, number>();
  const out: [string, string][] = [];
  for (let round = 0; round < n - 1; round++) {
    for (let i = 0; i < n / 2; i++) {
      const a = ring[i];
      const b = ring[n - 1 - i];
      if (!a || !b) continue;
      const pair: [string, string] = (whites.get(a) ?? 0) > (whites.get(b) ?? 0) ? [b, a] : [a, b];
      whites.set(pair[0], (whites.get(pair[0]) ?? 0) + 1);
      out.push(pair);
    }
    ring.splice(1, 0, ring.pop()!);
  }
  return out;
}

/** 1 for a win, ½ for a draw; unfinished games count as not played. */
export function standings(games: { whiteId: string; blackId: string; result: string | null }[]) {
  const table = new Map<string, { points: number; played: number }>();
  const row = (id: string) => table.get(id) ?? (table.set(id, { points: 0, played: 0 }), table.get(id)!);
  for (const g of games) {
    const w = row(g.whiteId);
    const b = row(g.blackId);
    if (!g.result) continue;
    w.played++;
    b.played++;
    if (g.result === "1-0") w.points += 1;
    else if (g.result === "0-1") b.points += 1;
    else {
      w.points += 0.5;
      b.points += 0.5;
    }
  }
  return table;
}
