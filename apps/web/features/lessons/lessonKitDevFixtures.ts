import type { Lesson, LessonStep } from "./types";
import type { Square } from "@/core/types/chess";

/** Kit `data-screen` ids for lesson flows (design-kit 05a–08, 06a/b, 07). */
export type KitLessonScreenId =
  | "les-intro"
  | "les-drill"
  | "les-tap"
  | "les-quiz"
  | "les-correct"
  | "les-wrong"
  | "les-hint"
  | "les-complete";

export function resolveKitLessonScreen(args: {
  phase: "playing" | "correct" | "wrong";
  step: LessonStep;
  hintLevel: number;
}): KitLessonScreenId {
  const { phase, step, hintLevel } = args;
  if (phase === "correct") return "les-correct";
  if (phase === "wrong") return "les-wrong";
  if (hintLevel >= 1 && step.kind === "move") return "les-hint";
  if (step.kind === "info") return "les-intro";
  if (step.kind === "quiz") return "les-quiz";
  if (step.kind === "move") {
    const tap =
      Boolean(step.visualSquare) ||
      (step.visualSquares?.length ?? 0) > 0 ||
      (step.highlight?.length ?? 0) > 0;
    return tap ? "les-tap" : "les-drill";
  }
  return "les-drill";
}

const BASE: Omit<Lesson, "steps"> = {
  id: "kit-dev",
  unit: "class-pieces",
  title: "Forks",
  subtitle: "Fork the king and queen",
  emoji: "♞",
  prerequisites: [],
  xp: 50,
  tag: "fork",
};

const MOVE_STEP: LessonStep = {
  id: "move",
  kind: "move",
  coach: "Find the fork.",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  solution: ["e2:e4"],
  successText: "Nice fork!",
  failText: "Not quite — try again!",
};

const MOVE_LESSON: Lesson = { ...BASE, id: "kit-05b", steps: [MOVE_STEP] };

/** Stable fixtures for /dev/lesson-kit and layout QA (not production curriculum). */
export const LESSON_KIT_DEV_FIXTURES: Record<
  "05a" | "05b" | "05c" | "05d" | "06a" | "06b" | "07" | "08",
  {
    lesson: Lesson;
    preview?: { stepIndex?: number; phase?: "playing" | "correct" | "wrong"; hintLevel?: number };
    complete?: boolean;
  }
> = {
  "05a": {
    lesson: {
      ...BASE,
      id: "kit-05a",
      steps: [
        {
          id: "intro",
          kind: "info",
          coach: "Pawns move forward one square — or two on their first move.",
          fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        },
      ],
    },
  },
  "05b": { lesson: MOVE_LESSON },
  "05c": {
    lesson: {
      ...BASE,
      id: "kit-05c",
      title: "Tap the squares",
      steps: [
        {
          id: "tap",
          kind: "move",
          coach: "Tap every square the knight attacks.",
          fen: "4k3/8/8/3N4/8/8/8/4K3 w - - 0 1",
          highlight: ["c6", "e6", "b5", "f5", "b3", "f3", "c2", "e2"] as Square[],
          visualSquare: "c6",
          solution: ["d5:f6"],
          successText: "Great!",
          failText: "Try again.",
        },
      ],
    },
  },
  "05d": {
    lesson: {
      ...BASE,
      id: "kit-05d",
      steps: [
        {
          id: "quiz",
          kind: "quiz",
          coach: "Why is this move strong?",
          question: "Why fork the king and queen?",
          options: [
            { label: "They cannot both escape", emoji: "♞" },
            { label: "It promotes a pawn", emoji: "♟" },
          ],
          solution: ["They cannot both escape"],
        },
      ],
    },
  },
  "06a": { lesson: { ...MOVE_LESSON, id: "kit-06a" }, preview: { phase: "correct" } },
  "06b": { lesson: { ...MOVE_LESSON, id: "kit-06b" }, preview: { phase: "wrong" } },
  "07": { lesson: { ...MOVE_LESSON, id: "kit-07" }, preview: { hintLevel: 1, phase: "playing" } },
  "08": { lesson: { ...MOVE_LESSON, id: "kit-08" }, complete: true },
};
