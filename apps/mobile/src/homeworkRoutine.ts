import { advanceStreak, isoDay } from "@/progression";

/** Daily routine step ids — matches web ROUTINE_STEPS. */
export const ROUTINE_STEP_IDS = [
  "warmup",
  "lesson",
  "practice",
  "match",
  "review",
  "reflection",
] as const;

export type RoutineStepId = (typeof ROUTINE_STEP_IDS)[number];

/** Mark a homework routine step done for today; bump streak when all six are complete. */
export function markHomeworkActivity(
  snap: Record<string, unknown>,
  activityId: string,
  today = isoDay(),
): Record<string, unknown> {
  const hd = { ...((snap.homeworkDone as Record<string, string[]>) ?? {}) };
  const todayDone = new Set(hd[today] ?? []);
  if (todayDone.has(activityId)) return snap;
  todayDone.add(activityId);
  hd[today] = [...todayDone];

  let homeworkStreak = (snap.homeworkStreak as number) ?? 0;
  let homeworkLastDay = (snap.homeworkLastDay as string | null) ?? null;

  const allDone = ROUTINE_STEP_IDS.every((id) => todayDone.has(id));
  if (allDone && homeworkLastDay !== today) {
    const next = advanceStreak(homeworkLastDay, today, homeworkStreak);
    homeworkStreak = next.streak;
    homeworkLastDay = next.day;
  }

  return { ...snap, homeworkDone: hd, homeworkStreak, homeworkLastDay };
}

export function markHomeworkActivities(
  snap: Record<string, unknown>,
  activityIds: string[],
  today = isoDay(),
): Record<string, unknown> {
  return activityIds.reduce((s, id) => markHomeworkActivity(s, id, today), snap);
}

export function routineDoneToday(snap: Record<string, unknown> | null | undefined, today = isoDay()): string[] {
  return ((snap?.homeworkDone as Record<string, string[]>) ?? {})[today] ?? [];
}

export function allRoutineDoneToday(snap: Record<string, unknown> | null | undefined, today = isoDay()): boolean {
  const done = routineDoneToday(snap, today);
  return ROUTINE_STEP_IDS.every((id) => done.includes(id));
}
