import type { Course } from "./course";
import type { BadgeId } from "./progress";

/**
 * The trophy room shows finished units once, as certificates, so their "Finish Unit N" badges stay out of the
 * badge grid; every other badge is grouped by what it rewards (its colour and icon).
 */
export const isUnitBadge = (id: string) => /^unit\d+$/.test(id);

export type BadgeKind = "streak" | "win" | "puzzle" | "practice" | "learn";
export function badgeKind(id: BadgeId): BadgeKind {
  if (id.startsWith("streak")) return "streak";
  if (["firstGame", "firstWin", "beatBishop", "bestWin", "highWin"].includes(id)) return "win";
  if (id.startsWith("puzzles") || id === "rating1000" || id === "daily5") return "puzzle";
  if (id === "practice5") return "practice";
  return "learn";
}

/** The day a unit was finished: its latest lesson completion (YYYY-MM-DD), or null while any lesson is open. */
export function unitFinishDay(course: Course, completed: Record<string, string>, unitId: string): string | null {
  const days = course.lessons.filter((l) => l.unit === unitId).map((l) => completed[l.id]);
  if (!days.length || days.some((d) => !d)) return null;
  return days.reduce((a, b) => (a > b ? a : b));
}
