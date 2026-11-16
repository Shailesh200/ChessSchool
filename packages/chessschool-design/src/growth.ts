import type { ShareCardData } from "./api";
import { dayKey, FREEZE_MAX, visibleStreak, type LocalState, type Progress } from "./progress";

/** The weekly progress card: lessons finished in the last 7 days, puzzles solved so far, and the streak. */
export function weekCard(p: Progress, now: Date): ShareCardData {
  const from = dayKey(new Date(now.getTime() - 6 * 86_400_000));
  const placed = new Set(p.placed);
  return {
    lessons: Object.entries(p.completed).filter(([id, day]) => !placed.has(id) && day >= from).length,
    puzzles: p.puzzles.solved,
    streak: visibleStreak(p.streak, dayKey(now)),
  };
}

/** Streak freezes from invite rewards. The streak never holds more than FREEZE_MAX; the server keeps the rest banked. */
export function addFreezes(s: LocalState, n: number): LocalState {
  const freezes = Math.min(FREEZE_MAX, (s.progress.streak.freezes ?? 0) + Math.max(0, Math.floor(n)));
  return freezes > 0 ? { ...s, progress: { ...s.progress, streak: { ...s.progress.streak, freezes } } } : s;
}
