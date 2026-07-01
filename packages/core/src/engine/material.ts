import { Chess } from "chess.js";
import type { PieceSymbol } from "../types/chess";

/** Standard piece values: pawn 1, knight/bishop 3, rook 5, queen 9. */
export const PIECE_POINTS: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Material on the board for each side and the advantage (white − black). */
export function materialAdvantage(fen: string): {
  white: number;
  black: number;
  diff: number;
} {
  let white = 0;
  let black = 0;
  for (const row of new Chess(fen).board()) {
    for (const cell of row) {
      if (!cell) continue;
      const v = PIECE_POINTS[cell.type as PieceSymbol];
      if (cell.color === "w") white += v;
      else black += v;
    }
  }
  return { white, black, diff: white - black };
}
