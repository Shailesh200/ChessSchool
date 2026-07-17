import type { LessonStep } from "@/features/lessons/types";
import type { MoveInput } from "@/core/types/chess";

export interface CalculationPuzzle {
  lessonId: string;
  stepIndex: number;
  title: string;
  tag: string;
  emoji: string;
  fen: string;
  orientation: "white" | "black";
  /** Primary solution — `from:to`. */
  solutionKey: string;
  allSolutions: string[];
  coach: string;
  successText: string;
  failText: string;
}

export function moveKey(move: Pick<MoveInput, "from" | "to">): string {
  return `${move.from}:${move.to}`;
}

export function moveMatchesSolution(
  move: Pick<MoveInput, "from" | "to">,
  solutions: string[],
): boolean {
  return solutions.includes(moveKey(move));
}

export function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function pickIndex(length: number, seed: string): number {
  if (length <= 0) return 0;
  return hashSeed(seed) % length;
}

/** First interactive move step in a homework lesson. */
export function firstMoveStep(
  steps: LessonStep[],
): { index: number; step: LessonStep } | null {
  const index = steps.findIndex(
    (s) =>
      s.kind === "move" && s.fen && Array.isArray(s.solution) && s.solution.length > 0,
  );
  if (index < 0) return null;
  return { index, step: steps[index]! };
}

export function puzzleFromStep(
  meta: { id: string; title: string; tag: string; emoji: string },
  index: number,
  step: LessonStep,
): CalculationPuzzle | null {
  if (!step.fen || !step.solution?.length) return null;
  return {
    lessonId: meta.id,
    stepIndex: index,
    title: meta.title,
    tag: step.tag ?? meta.tag,
    emoji: meta.emoji,
    fen: step.fen,
    orientation: step.orientation ?? "white",
    solutionKey: step.solution[0]!,
    allSolutions: step.solution,
    coach: step.coach,
    successText: step.successText ?? "Correct!",
    failText: step.failText ?? "Not quite — calculate again or reveal the answer.",
  };
}
