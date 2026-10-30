/**
 * Lesson and puzzle answers stay `from:to` so shipped clients keep working.
 * When the expected move promotes, the step also carries the piece.
 *
 * - `promotion` — every listed solution promotes to this one piece.
 * - `promotions` — keyed by the same `from:to` strings, used when one step
 *   lists several moves that do not all promote to the same piece. A key in
 *   this map wins over `promotion`. One `from:to` still names a single piece;
 *   accepting two pieces on the same squares means omitting both fields
 *   (legacy lenient check). That case is not in the bank.
 *
 * Old clients ignore both fields and accept any piece. New clients call
 * `matchesSolution`. A step with no piece stays lenient.
 */

export const PROMOTION_PIECES = ["q", "r", "b", "n"] as const;
export type PromotionPiece = (typeof PROMOTION_PIECES)[number];

export function isPromotionPiece(value: unknown): value is PromotionPiece {
  return value === "q" || value === "r" || value === "b" || value === "n";
}

export type SolutionLike = {
  solution?: readonly string[] | null;
  promotion?: PromotionPiece;
  promotions?: Readonly<Partial<Record<string, PromotionPiece>>>;
};

export type PlayedMove = {
  from: string;
  to: string;
  promotion?: string | null;
};

export function solutionKey(move: Pick<PlayedMove, "from" | "to">): string {
  return `${move.from}:${move.to}`;
}

/** Piece the step requires for this `from:to`, if it names one. */
export function expectedPromotion(
  step: SolutionLike,
  key: string,
): PromotionPiece | undefined {
  const mapped = step.promotions?.[key];
  if (isPromotionPiece(mapped)) return mapped;
  if (isPromotionPiece(step.promotion)) return step.promotion;
  return undefined;
}

/**
 * True when `move` is one of the step's solutions and, if the step names a
 * promotion piece, the played piece matches. A wrong piece is a wrong answer.
 */
export function matchesSolution(step: SolutionLike, move: PlayedMove): boolean {
  const key = solutionKey(move);
  if (!step.solution?.includes(key)) return false;
  const expected = expectedPromotion(step, key);
  if (!expected) return true;
  return move.promotion === expected;
}
