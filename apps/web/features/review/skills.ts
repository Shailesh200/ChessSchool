import type { LessonRecord } from "@/core/store/progression.store";

export type ReviewSkill = {
  id: string;
  title: string;
  icon: string;
  lessonId: string;
  fixture: number;
};

/** Design 20 / 10a skills, wired to real curriculum lesson ids. */
export const REVIEW_CATALOG: ReviewSkill[] = [
  {
    id: "fork",
    title: "Fork the king and queen",
    icon: "target",
    lessonId: "fork-master",
    fixture: 48,
  },
  {
    id: "pin",
    title: "Pins to the king",
    icon: "lock",
    lessonId: "pin-it",
    fixture: 55,
  },
  {
    id: "knight",
    title: "Knight moves",
    icon: "puzzle",
    lessonId: "knight-hops",
    fixture: 90,
  },
  {
    id: "mate",
    title: "Back-rank mate",
    icon: "trophy",
    lessonId: "mate-in-one",
    fixture: 72,
  },
  {
    id: "protect",
    title: "Protect your pieces",
    icon: "shield-check",
    lessonId: "pre-pieces-king",
    fixture: 81,
  },
  {
    id: "castle",
    title: "Castling",
    icon: "crown",
    lessonId: "pre-moves-castling",
    fixture: 64,
  },
];

export const PRACTICE_LINE = 60;

export function skillPercent(
  record: LessonRecord | undefined,
  fixture: boolean,
  fixturePct: number,
): number {
  if (fixture) return fixturePct;
  if (!record) return 0;
  return Math.round(Math.max(0, Math.min(1, record.mastery)) * 100);
}

export function reviewDueCount(
  lessons: Record<string, LessonRecord>,
  now = Date.now(),
): number {
  return REVIEW_CATALOG.filter((skill) => {
    const record = lessons[skill.lessonId];
    if (!record) return true;
    return record.mastery < 1 && record.dueAt <= now;
  }).length;
}

/** Position from the fix-mistakes design (knight on a7, black queen on a2). */
export const FIX_FEN = "4k3/Np3pp1/8/8/8/8/q4pp1/6K1 w - - 0 1";
