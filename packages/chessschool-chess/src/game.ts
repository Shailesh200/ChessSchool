import { Chess, type Move } from "chess.js";
import { isSquare, readFen, type Color, type MoveRef, type Square } from "./board";

export type { Move };

/** Drill positions (e.g. a lone rook collecting stars) have no kings, so skip validation. */
export function load(fen: string): Chess {
  return new Chess(fen, { skipValidation: true });
}

export function legalTargets(chess: Chess, from: Square): Square[] {
  return chess.moves({ square: from, verbose: true }).map((m) => m.to as Square);
}

/** Plays from→to if legal; pawns reaching the last rank become a queen unless told otherwise. */
export function tryMove(chess: Chess, from: Square, to: Square, promotion: "q" | "r" | "b" | "n" = "q"): Move | null {
  const legal = chess.moves({ square: from, verbose: true }).find((m) => m.to === to);
  if (!legal) return null;
  return chess.move({ from, to, promotion: legal.promotion ? promotion : undefined });
}

export function needsPromotion(chess: Chess, from: Square, to: Square): boolean {
  return chess.moves({ square: from, verbose: true }).some((m) => m.to === to && Boolean(m.promotion));
}

/** Gives the move back to `color` (used by single-piece drills where the other side never moves). */
export function withTurn(fen: string, color: Color): string {
  const parts = fen.split(/\s+/);
  parts[1] = color;
  parts[3] = "-";
  return parts.join(" ");
}

export function kingInCheck(chess: Chess): Square | null {
  if (!chess.inCheck()) return null;
  const color = chess.turn();
  for (const [sq, p] of readFen(chess.fen())) if (p.type === "k" && p.color === color) return sq;
  return null;
}

export type GameOutcome = { kind: "checkmate"; winner: Color } | { kind: "stalemate" | "draw" | "repetition" | "material" } | null;

export function outcome(chess: Chess): GameOutcome {
  if (chess.isCheckmate()) return { kind: "checkmate", winner: chess.turn() === "w" ? "b" : "w" };
  if (chess.isStalemate()) return { kind: "stalemate" };
  if (chess.isInsufficientMaterial()) return { kind: "material" };
  if (chess.isThreefoldRepetition()) return { kind: "repetition" };
  if (chess.isDraw()) return { kind: "draw" };
  return null;
}

export const moveRef = (m: Pick<Move, "from" | "to">): MoveRef => ({ from: m.from as Square, to: m.to as Square });

export function parseUci(uci: string): MoveRef | null {
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  return isSquare(from) && isSquare(to) ? { from, to } : null;
}

/** Pieces each side has lost since `startFen` (promotions can make this approximate). */
export function capturedPieces(startFen: string, fen: string): Record<Color, ("q" | "r" | "b" | "n" | "p")[]> {
  const count = (f: string) => {
    const c: Record<string, number> = {};
    for (const p of readFen(f).values()) c[p.color + p.type] = (c[p.color + p.type] ?? 0) + 1;
    return c;
  };
  const a = count(startFen);
  const b = count(fen);
  const out: Record<Color, ("q" | "r" | "b" | "n" | "p")[]> = { w: [], b: [] };
  for (const color of ["w", "b"] as const) {
    for (const t of ["q", "r", "b", "n", "p"] as const) {
      const lost = (a[color + t] ?? 0) - (b[color + t] ?? 0);
      for (let i = 0; i < lost; i++) out[color].push(t);
    }
  }
  return out;
}
