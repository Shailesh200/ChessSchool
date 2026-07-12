/** Class exam helpers — mirrors apps/web/features/school/classExam.ts */

type Step = { kind: string };

export function scoredStepCount(steps: Step[]): number {
  return steps.filter((s) => s.kind === "move" || s.kind === "quiz").length;
}

export function isTutorialLesson(steps: Step[], exam = false): boolean {
  if (exam) return false;
  return scoredStepCount(steps) === 0;
}

/** Web placement: 70%+ → highest stage, 40%+ → middle, else lowest. */
export function placementStageIndex(pct: number, maxIndex: number): number {
  if (pct >= 0.7) return maxIndex;
  if (pct >= 0.4) return Math.min(1, maxIndex);
  return 0;
}

export const EXAM_PASS_RATIO = 0.67;
