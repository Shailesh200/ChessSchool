import type { LessonStep } from "@/features/lessons/types";

/** Pass threshold — keep in sync with apps/mobile/src/classExam.ts */
export const EXAM_PASS_RATIO = 0.67;

/** Class quick-test length (move puzzles sampled from the class). */
export const CLASS_EXAM_STEP_LIMIT = 5;

/** Minimum scored steps before we consider a class exam viable (≥2 for 67% pass bar). */
export const CLASS_EXAM_MIN_STEPS = 2;

/** School graduation exam length (random puzzles across a stage). */
export const SCHOOL_EXAM_STEP_COUNT = 8;

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

/** Exams accept only single-move puzzles (one solution ply). */
export function isExamMoveStep(step: LessonStep): boolean {
  return (
    step.kind === "move" &&
    Array.isArray(step.solution) &&
    step.solution.length === 1 &&
    Boolean(step.fen)
  );
}

export function filterExamMoveSteps(steps: LessonStep[]): LessonStep[] {
  return steps.filter(isExamMoveStep);
}

function collectMoveSteps(rows: TeachingRow[]): LessonStep[] {
  return filterExamMoveSteps(rows.flatMap((r) => parseSteps(r.steps)));
}

/** Fisher–Yates shuffle (mutates copy). */
export function shuffleInPlace<T>(arr: T[], random = Math.random): T[] {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Pick up to `count` exam puzzles in random order. */
export function pickSchoolExamSteps(
  steps: LessonStep[],
  count = SCHOOL_EXAM_STEP_COUNT,
  random = Math.random,
): LessonStep[] {
  const pool = filterExamMoveSteps(steps);
  return shuffleInPlace(pool, random).slice(0, count);
}

/**
 * Build a short class exam from recent teaching lessons — move puzzles when
 * available, otherwise quiz steps (Pre-School classes).
 */
export function buildClassExamSteps(
  teaching: TeachingRow[],
  limit = CLASS_EXAM_STEP_LIMIT,
): LessonStep[] {
  const recent = teaching.slice(-2);
  let moves = collectMoveSteps(recent.length ? recent : teaching);
  if (moves.length < limit) {
    const all = collectMoveSteps(teaching);
    if (all.length > moves.length) moves = all;
  }
  if (moves.length > 0) return sampleExamSteps(moves, limit);

  const quizPool = (recent.length ? recent : teaching).flatMap((r) =>
    parseSteps(r.steps).filter((s) => s.kind === "quiz"),
  );
  let quizzes = quizPool;
  if (quizzes.length < limit) {
    const allQuizzes = teaching.flatMap((r) =>
      parseSteps(r.steps).filter((s) => s.kind === "quiz"),
    );
    if (allQuizzes.length > quizzes.length) quizzes = allQuizzes;
  }
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

/** True when a class has enough scored steps for a fair quick test. */
export function classExamHasMinSteps(steps: LessonStep[]): boolean {
  return scoredStepCount(steps) >= CLASS_EXAM_MIN_STEPS;
}
