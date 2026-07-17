export const MASTERY_THRESHOLD = 0.5;

/** A lesson unlocks once every prerequisite is at/above the mastery threshold. */
export function isLessonUnlocked(
  lessonId: string,
  prerequisites: string[],
  records: Record<string, { mastery: number }>,
): boolean {
  if (prerequisites.length === 0) return true;
  return prerequisites.every((pre) => (records[pre]?.mastery ?? 0) >= MASTERY_THRESHOLD);
}
