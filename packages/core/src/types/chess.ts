/** Shared chess domain types (framework-agnostic). */

export type Square = string; // e.g. "e4"
export type PieceSymbol = "p" | "n" | "b" | "r" | "q" | "k";
export type Color = "w" | "b";

export interface MoveInput {
  from: Square;
  to: Square;
  promotion?: PieceSymbol;
}

/** A verbose move as produced by chess.js history/moves. */
export interface VerboseMove {
  color: Color;
  from: Square;
  to: Square;
  piece: PieceSymbol;
  san: string;
  flags: string;
  captured?: PieceSymbol;
  promotion?: PieceSymbol;
}

export type GameStatus =
  | "playing"
  | "check"
  | "checkmate"
  | "stalemate"
  | "draw"
  | "threefold"
  | "insufficient";

export interface BoardArrow {
  startSquare: Square;
  endSquare: Square;
  color: string;
}
