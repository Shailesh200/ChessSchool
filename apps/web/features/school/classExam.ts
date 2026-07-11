import type { LessonStep } from "@/features/lessons/types";

/** Evenly sample up to `n` items across the array. */
export function sampleExamSteps<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]!);
}

type TeachingRow = { steps: string };

function parseSteps(raw: string): LessonStep[] {
  try {
    const steps = JSON.parse(raw) as LessonStep[];
    return Array.isArray(steps) ? steps : [];
  } catch {
    return [];
  }
}

/**
 * Build a short class exam from recent teaching lessons — move puzzles when
 * available, otherwise quiz steps (Pre-School classes).
 */
export function buildClassExamSteps(
  teaching: TeachingRow[],
  limit = 5,
): LessonStep[] {
  const recent = teaching.slice(-2);
  const pool = recent.length ? recent : teaching;

  const moves = pool.flatMap((r) => parseSteps(r.steps).filter((s) => s.kind === "move"));
  if (moves.length > 0) return sampleExamSteps(moves, limit);

  const quizzes = pool.flatMap((r) => parseSteps(r.steps).filter((s) => s.kind === "quiz"));
  if (quizzes.length > 0) return sampleExamSteps(quizzes, limit);

  return [];
}

export function scoredStepCount(steps: LessonStep[]): number {
  return steps.filter((s) => s.kind === "move" || s.kind === "quiz").length;
}

export function isTutorialLesson(steps: LessonStep[], exam = false): boolean {
  if (exam) return false;
  return scoredStepCount(steps) === 0;
}
