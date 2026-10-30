import type { LessonStep } from "@/features/lessons/types";
import { Chess } from "chess.js";

const SENSITIVE_KEYS = [
  "solution",
  "moves",
  "correct",
  "explain",
  "promotions",
  "promotion",
] as const;

/** Strip answer material from lesson steps served to clients. */
export function stripLessonStepsForClient(steps: LessonStep[]): LessonStep[] {
  return steps.map((step) => {
    const out: LessonStep = { ...step };
    for (const key of SENSITIVE_KEYS) {
      delete (out as unknown as Record<string, unknown>)[key];
    }
    return out;
  });
}

function normMoveKey(from: string, to: string, promotion?: string): string {
  return `${from}:${to}${promotion ? `=${promotion}` : ""}`;
}

function moveMatchesSolution(
  step: LessonStep,
  from: string,
  to: string,
  promotion?: string,
): boolean {
  const solutions = step.solution ?? [];
  const key = normMoveKey(from, to, promotion ?? step.promotion ?? "q");
  if (solutions.includes(key)) return true;
  const bare = `${from}:${to}`;
  if (solutions.includes(bare)) return true;
  const promoMap = step.promotions;
  if (promoMap && promoMap[bare]) {
    return normMoveKey(from, to, promotion ?? promoMap[bare]) === `${bare}=${promoMap[bare]}`;
  }
  return false;
}

export function verifyLessonStepAnswer(
  step: LessonStep,
  answer:
    | { kind: "move"; from: string; to: string; promotion?: string }
    | { kind: "quiz"; choice: number },
): boolean {
  if (answer.kind === "quiz") {
    if (step.kind !== "quiz") return false;
    return answer.choice === step.correct;
  }
  if (step.kind !== "move" || !step.fen) return false;
  if (!moveMatchesSolution(step, answer.from, answer.to, answer.promotion)) {
    return false;
  }
  const g = new Chess(step.fen);
  try {
    const applied = g.move({
      from: answer.from,
      to: answer.to,
      promotion: (answer.promotion ?? step.promotion ?? "q") as "q" | "r" | "b" | "n",
    });
    return Boolean(applied);
  } catch {
    return false;
  }
}
