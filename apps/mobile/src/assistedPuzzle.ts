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
