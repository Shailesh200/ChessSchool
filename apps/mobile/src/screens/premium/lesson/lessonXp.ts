/** Display XP on lesson complete: +10 per scored puzzle correct; none when zero correct. */
export function lessonDisplayXp(correctPuzzles: number, xpPerPuzzle = 10): number {
  if (correctPuzzles <= 0) return 0;
  return correctPuzzles * xpPerPuzzle;
}

export function lessonXpSummary(correctPuzzles: number, totalPuzzles: number, xpPerPuzzle = 10): string | null {
  const xp = lessonDisplayXp(correctPuzzles, xpPerPuzzle);
  if (xp <= 0) return null;
  if (totalPuzzles <= 0) return `+${xp} XP`;
  return `${correctPuzzles} puzzle${correctPuzzles === 1 ? "" : "s"} × +${xpPerPuzzle} XP = ${xp} XP`;
}
