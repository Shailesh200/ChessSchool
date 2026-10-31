import type { Lesson, LessonStep } from "./types";
import type { BoardArrow, Square } from "@/core/types/chess";

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

export type LessonKitDevPreview = {
  stepIndex?: number;
  phase?: "playing" | "correct" | "wrong";
  hintLevel?: number;
  kitLabels?: { tag?: string; title?: string };
  /** Overrides tip row; `null` hides the hintline (Muse empty `.lx`). */
  hintLine?: string | null;
  progressPct?: number;
  verbatimCoach?: boolean;
  coachStillSrc?: string;
  quizPickedIndex?: number;
};

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

const FORK_FEN_AFTER = "4k3/ppp1qppp/2N5/8/8/8/P4PPP/6K1 w - - 0 1";
const KIT_ARROW = "#FF7A59";
const FORK_ARROWS: BoardArrow[] = [
  { startSquare: "c7", endSquare: "e8", color: KIT_ARROW },
  { startSquare: "c7", endSquare: "e6", color: KIT_ARROW },
];

const OTTO_NEUTRAL = "/premium/assets/coaches/still/otto-neutral.webp";
const OTTO_THINKING = "/premium/assets/coaches/still/otto-thinking.webp";
const OTTO_HAPPY = "/premium/assets/coaches/still/otto-happy.webp";

/** Stable fixtures for /dev/lesson-kit and layout QA (not production curriculum). */
export const LESSON_KIT_DEV_FIXTURES: Record<
  "05a" | "05b" | "05c" | "05d" | "06a" | "06b" | "07" | "08",
  {
    lesson: Lesson;
    preview?: LessonKitDevPreview;
    complete?: boolean;
  }
> = {
  "05a": {
    lesson: {
      ...BASE,
      id: "kit-05a",
      title: "Lesson 3",
      subtitle: "A fork attacks two pieces at once",
      steps: [
        {
          id: "intro",
          kind: "info",
          coach:
            "Let's look at this one together. The knight on c7 attacks the king and the rook.",
          fen: "r2qk2r/ppp2ppp/2n5/8/8/5PPP/PP3P2/6K1 w - - 0 1",
          highlight: ["c7"] as Square[],
          targetSquares: ["a8", "e8"] as Square[],
          arrows: [
            { startSquare: "c7", endSquare: "a8", color: KIT_ARROW },
            { startSquare: "c7", endSquare: "e8", color: KIT_ARROW },
          ],
        },
      ],
    },
    preview: {
      kitLabels: { tag: "Lesson 3 · Forks", title: "A fork attacks two pieces at once" },
      progressPct: 25,
      verbatimCoach: true,
      coachStillSrc: OTTO_NEUTRAL,
      hintLine: null,
    },
  },
  "05b": {
    lesson: {
      ...MOVE_LESSON,
      id: "kit-05b",
      title: "Lesson 3",
      subtitle: "Find the fork",
      steps: [
        {
          ...MOVE_STEP,
          coach:
            "Look at what the knight can reach. Find a move that attacks two pieces.",
          fen: "4k3/ppp1qppp/1n6/1N6/8/8/P4PPP/6K1 w - - 0 1",
          solution: ["b5:c7"],
          highlight: ["b5"] as Square[],
        },
      ],
    },
    preview: {
      kitLabels: { tag: "Lesson 3 · Your turn", title: "Find the fork" },
      hintLine: "White to move · find the fork",
      progressPct: 50,
      verbatimCoach: true,
      coachStillSrc: OTTO_THINKING,
    },
  },
  "05c": {
    lesson: {
      ...BASE,
      id: "kit-05c",
      title: "Lesson 3",
      subtitle: "Where can this knight jump?",
      steps: [
        {
          id: "tap",
          kind: "move",
          coach:
            "Let's look at this one together. Tap every square the knight on d4 attacks.",
          fen: "4k3/8/8/3N4/8/8/4K3/8 w - - 0 1",
          highlight: ["c6", "e6", "b5", "f5", "b3", "f3", "c2", "e2"] as Square[],
          visualSquare: "d4",
          solution: ["d5:f6"],
          successText: "Great!",
          failText: "Try again.",
        },
      ],
    },
    preview: {
      kitLabels: { tag: "Lesson 3 · Tap the squares", title: "Where can this knight jump?" },
      hintLine: "5 of 8 squares selected",
      progressPct: 62,
      verbatimCoach: true,
      coachStillSrc: OTTO_NEUTRAL,
    },
  },
  "05d": {
    lesson: {
      ...BASE,
      id: "kit-05d",
      title: "Lesson 3",
      subtitle: "Why did Nc7 win?",
      steps: [
        {
          id: "quiz",
          kind: "quiz",
          coach: "Look at the board. What does the knight on c7 do?",
          fen: FORK_FEN_AFTER,
          highlight: ["c7", "e5"] as Square[],
          targetSquares: ["e8", "e6"] as Square[],
          arrows: FORK_ARROWS,
          question: "Why did Nc7 win?",
          options: [
            {
              label: "It attacks two pieces at once",
              subtitle: "Black can only save one of them",
            },
            {
              label: "It threatens checkmate in one",
              subtitle: "The king has no moves",
            },
            {
              label: "It traps the knight",
              subtitle: "The knight cannot escape",
            },
          ],
          solution: ["It attacks two pieces at once"],
          correct: 0,
        },
      ],
    },
    preview: {
      kitLabels: { tag: "Lesson 3 · Why it works", title: "Why did Nc7 win?" },
      progressPct: 75,
      verbatimCoach: true,
      coachStillSrc: OTTO_THINKING,
      quizPickedIndex: 0,
      hintLine: null,
    },
  },
  "06a": {
    lesson: {
      ...MOVE_LESSON,
      id: "kit-06a",
      subtitle: "Find the fork",
      steps: [
        {
          ...MOVE_STEP,
          coach: "Nicely done. You saw the fork.",
          fen: FORK_FEN_AFTER,
          highlight: ["c7", "e5"] as Square[],
          targetSquares: ["e8", "e6"] as Square[],
          arrows: FORK_ARROWS.map((a) => ({ ...a, color: "#34d399" })),
          solution: ["b5:c7"],
          successText: "Nicely done. You saw the fork.",
        },
      ],
    },
    preview: {
      phase: "correct",
      kitLabels: { tag: "Lesson 3 · Your turn", title: "Find the fork" },
      hintLine: "White to move · find the fork",
      progressPct: 60,
      verbatimCoach: true,
      coachStillSrc: OTTO_HAPPY,
    },
  },
  "06b": {
    lesson: {
      ...MOVE_LESSON,
      id: "kit-06b",
      subtitle: "Find the fork",
      steps: [
        {
          ...MOVE_STEP,
          coach: "Look at what the knight can reach. Find a move that attacks two pieces.",
          fen: "4k3/ppp1qppp/1n6/1N6/8/8/P4PPP/6K1 w - - 0 1",
          solution: ["b5:c7"],
          failText: "Not quite — the knight on b5 can reach c7 and fork king and queen.",
          highlight: ["b5"] as Square[],
        },
      ],
    },
    preview: {
      phase: "wrong",
      kitLabels: { tag: "Lesson 3 · Your turn", title: "Find the fork" },
      hintLine: "White to move · find the fork",
      progressPct: 60,
      verbatimCoach: true,
      coachStillSrc: OTTO_THINKING,
    },
  },
  "07": {
    lesson: {
      ...MOVE_LESSON,
      id: "kit-07",
      title: "Lesson 3",
      subtitle: "Here is where to look",
      steps: [
        {
          ...MOVE_STEP,
          coach:
            "Look at what the knight can reach. Move it from b5 to c7 to check the king and attack the queen.",
          fen: "4k3/ppp1qppp/1n6/1N6/8/8/P4PPP/6K1 w - - 0 1",
          solution: ["b5:c7"],
          highlight: ["b5"] as Square[],
        },
      ],
    },
    preview: {
      hintLevel: 2,
      phase: "playing",
      kitLabels: { tag: "Lesson 3 · Hint 3 of 3", title: "Here is where to look" },
      hintLine: "Hints cost no XP, but they show in your summary",
      progressPct: 50,
      verbatimCoach: true,
      coachStillSrc: OTTO_THINKING,
    },
  },
  "08": {
    lesson: {
      ...BASE,
      id: "kit-08",
      subtitle: "Fork the king and queen",
      xp: 20,
      steps: [],
    },
    complete: true,
  },
};
