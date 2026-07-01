type LessonRec = { mastery: number; attempts: number; lastSeen: number; dueAt: number; incorrect?: number };

/** Lesson ids due for spaced-repetition review (mastered once, not yet solid). */
export function dueLessonIds(
  lessons: Record<string, LessonRec>,
  now = Date.now(),
): string[] {
  return Object.entries(lessons)
    .filter(([, r]) => r.dueAt <= now && r.mastery > 0 && r.mastery < 0.9)
    .sort((a, b) => a[1].dueAt - b[1].dueAt)
    .map(([id]) => id);
}

/** Deterministic daily puzzle id from a stable pool and ISO day. */
export function dailyPuzzleId(pool: string[], day: string): string | null {
  if (!pool.length) return null;
  let hash = 0;
  for (let i = 0; i < day.length; i++) hash = (hash * 31 + day.charCodeAt(i)) >>> 0;
  return pool[hash % pool.length] ?? null;
}

export function isDailyPuzzleDone(day: string, completedDay?: string | null): boolean {
  return completedDay === day;
}
