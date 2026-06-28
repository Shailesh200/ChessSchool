import type { LessonRecord } from "@/core/store/progression.store";
import { getLesson } from "./curriculum";

export const MASTERY_THRESHOLD = 0.5;

/** A lesson unlocks once every prerequisite is at/above the mastery threshold. */
export function isUnlocked(
  lessonId: string,
  records: Record<string, LessonRecord>,
): boolean {
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  if (lesson.prerequisites.length === 0) return true;
  return lesson.prerequisites.every(
    (pre) => (records[pre]?.mastery ?? 0) >= MASTERY_THRESHOLD,
  );
}

export function masteryOf(
  lessonId: string,
  records: Record<string, LessonRecord>,
): number {
  return records[lessonId]?.mastery ?? 0;
}
