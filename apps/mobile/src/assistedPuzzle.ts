import {
  matchesSolution,
  type PromotionPiece,
  type SolutionLike,
} from "@chess-school/progression";

export type AssistedPuzzleAnswer = {
  allSolutions: readonly string[];
  promotion?: PromotionPiece;
  promotions?: SolutionLike["promotions"];
};

export type AssistedPromotion = "q" | "r" | "b" | "n";

/**
 * Move played on the board. The piece is the one the student chose
 * (the board passes `"q"` only when the move does not promote).
 * Free-play `handleMove` and the puzzle drill both use this object.
 */
export function assistedEngineMove(
  from: string,
  to: string,
  promotion: AssistedPromotion = "q",
): { from: string; to: string; promotion: AssistedPromotion } {
  return { from, to, promotion };
}

/**
 * Grade an assisted-drill answer. `promotion` is the piece the student played
 * (the board passes `"q"` when the move does not promote). A step that names
 * a piece rejects every other piece.
 */
export function assistedMoveOk(
  puzzle: AssistedPuzzleAnswer,
  move: { from: string; to: string; promotion?: string | null },
): boolean {
  return matchesSolution(
    {
      solution: puzzle.allSolutions,
      promotion: puzzle.promotion,
      promotions: puzzle.promotions,
    },
    move,
  );
}
