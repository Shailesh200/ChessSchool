import { deriveGridHighlights } from "./boardGrid";

/** Stable Pre-School ids — keep in sync with apps/web/content/data/school.mjs */
export const PRESCHOOL_STAGE_ID = "preschool";
export const PRESCHOOL_CLASS_IDS = [
  "class-pre-board",
  "class-pre-pieces",
  "class-pre-rules",
  "class-pre-moves",
  "class-pre-language",
] as const;

export const PRESCHOOL_CLASS_LESSONS: Record<(typeof PRESCHOOL_CLASS_IDS)[number], string[]> = {
  "class-pre-board": ["pre-board-intro", "pre-board-setup", "pre-square-d5", "pre-square-e4"],
  "class-pre-pieces": ["pre-pieces-roster", "pre-pieces-queen", "pre-pieces-king"],
  "class-pre-rules": [
    "pre-rules-blocking",
    "pre-rules-check-intro",
    "pre-rules-check-quiz",
    "pre-rules-escape-intro",
    "pre-rules-checkmate-intro",
    "pre-rules-checkmate-quiz",
    "pre-rules-stalemate",
    "pre-rules-promotion",
    "pre-rules-promotion-quiz",
    "pre-rules-castling",
    "pre-rules-castling-quiz",
  ],
  "class-pre-moves": [
    "pre-moves-e4",
    "pre-pawn-basics",
    "pre-pawn-quiz",
    "pre-knight-basics",
    "pre-knight-quiz",
    "pre-rook-basics",
    "pre-rook-quiz",
    "pre-bishop-basics",
    "pre-bishop-quiz",
    "pre-queen-moves",
    "pre-queen-slide-quiz",
    "pre-king-moves",
    "pre-king-quiz",
    "pre-moves-escape-check",
    "pre-moves-promotion",
    "pre-moves-castling",
  ],
  "class-pre-language": [
    "pre-notation-files",
    "pre-notation-e-file",
    "pre-notation-ranks",
    "pre-notation-d6",
    "pre-notation-piece-letters",
    "pre-notation-pawn-e4",
    "pre-notation-pawn-capture",
    "pre-notation-watch",
    "pre-notation-read-d6",
    "pre-notation-practice",
  ],
};

/** Single linear path through Pre-School — board → pieces → rules → moves → language. */
export const PRESCHOOL_LESSON_ORDER = PRESCHOOL_CLASS_IDS.flatMap((id) => PRESCHOOL_CLASS_LESSONS[id]);

const ALL_PRESCHOOL_LESSONS = PRESCHOOL_LESSON_ORDER;
const MASTERED = 0.9;

export function preschoolPrerequisite(lessonId: string): string[] {
  const idx = PRESCHOOL_LESSON_ORDER.indexOf(lessonId as (typeof PRESCHOOL_LESSON_ORDER)[number]);
  if (idx <= 0) return [];
  return [PRESCHOOL_LESSON_ORDER[idx - 1]!];
}

export function isPreschoolLesson(lessonId: string): boolean {
  return lessonId.startsWith("pre-");
}

type GridStep = {
  highlight?: string[];
  highlightFiles?: string[];
  highlightRanks?: number[];
  visualSquare?: string;
  visualSquares?: string[];
};

type TutorialArrow = { startSquare: string; endSquare: string; color?: string };
type TutorialStep = GridStep & {
  kind?: string;
  arrows?: TutorialArrow[];
  moves?: string[];
  solution?: string[];
};

const DEFAULT_ARROW = "#34d399";

function normArrow(a: TutorialArrow): { startSquare: string; endSquare: string; color: string } {
  return { startSquare: a.startSquare, endSquare: a.endSquare, color: a.color ?? DEFAULT_ARROW };
}

/** Square, file, rank + arrow overlays for tutorial steps (info / observe / move). */
export function deriveTutorialVisuals(step: TutorialStep | undefined): {
  highlight: string[];
  highlightFiles: string[];
  highlightRanks: number[];
  arrows: { startSquare: string; endSquare: string; color: string }[];
} {
  if (!step) return { highlight: [], highlightFiles: [], highlightRanks: [], arrows: [] };
  const grid = deriveGridHighlights(step);
  const highlight = new Set(grid.highlight);
  const arrows = (step.arrows ?? []).map(normArrow);

  for (const a of step.arrows ?? []) {
    highlight.add(a.startSquare);
    highlight.add(a.endSquare);
  }
  for (const m of step.moves ?? []) {
    const [from, to] = m.split(":");
    if (from) highlight.add(from);
    if (to) highlight.add(to);
    if (from && to && !step.arrows?.length) {
      arrows.push({ startSquare: from, endSquare: to, color: DEFAULT_ARROW });
    }
  }
  if (step.kind === "move" && step.solution?.[0]) {
    const [from, to] = step.solution[0]!.split(":");
    if (from) highlight.add(from);
    if (to) highlight.add(to);
  }

  return {
    highlight: [...highlight],
    highlightFiles: grid.highlightFiles,
    highlightRanks: grid.highlightRanks,
    arrows,
  };
}

type LessonRec = { mastery?: number; attempts?: number };

/** True when every Pre-School lesson is mastered or all classes are graduated. */
export function preschoolComplete(snap: {
  lessons?: Record<string, LessonRec>;
  graduatedClasses?: string[];
}): boolean {
  const graduated = snap.graduatedClasses ?? [];
  if (PRESCHOOL_CLASS_IDS.every((id) => graduated.includes(id))) return true;

  const lessons = snap.lessons ?? {};
  const anyStarted = ALL_PRESCHOOL_LESSONS.some((id) => (lessons[id]?.attempts ?? 0) > 0);
  if (!anyStarted) return false;

  return ALL_PRESCHOOL_LESSONS.every((id) => (lessons[id]?.mastery ?? 0) >= MASTERED);
}

/** Recommend optional Pre-School during onboarding "Brand new" (targetElo 600). */
export function shouldRecommendPreschool(targetElo: number, snap: Parameters<typeof preschoolComplete>[0]): boolean {
  return targetElo <= 600 && !preschoolComplete(snap);
}
