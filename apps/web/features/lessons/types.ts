import type { BoardArrow, Square } from "@/core/types/chess";

/**
 * Lesson step kinds — the school flow is Learn → Observe → Try → Master.
 * Pre-School Q&A uses interactive `quiz` steps (no board).
 *  - "info":    explanation on a static board
 *  - "observe": an auto-played example line the student watches
 *  - "move":    the student must find the correct move
 *  - "quiz":    multiple-choice question with illustrated visuals
 */
export type StepKind = "info" | "observe" | "move" | "quiz";

/** Animated illustration keys for Pre-School quiz steps. */
export type PreschoolVisual =
  | "board-grid"
  | "square"
  | "square-path"
  | "files"
  | "ranks"
  | "e-file"
  | "start-ranks"
  | "piece-roster"
  | "royalty"
  | "notation-letters"
  | "notation-capture";

export interface QuizOption {
  label: string;
  emoji?: string;
}

export interface LessonStep {
  id: string;
  kind: StepKind;
  /** Coach narration shown for this step. */
  coach: string;
  fen?: string;
  orientation?: "white" | "black";
  /** "move" steps: acceptable moves expressed as `from:to`. */
  solution?: string[];
  /** "observe" steps: a sequence of moves `from:to` auto-played in order. */
  moves?: string[];
  arrows?: BoardArrow[];
  highlight?: Square[];
  /** highlight entire files (columns a–h) while teaching */
  highlightFiles?: string[];
  /** highlight entire ranks (rows 1–8) while teaching */
  highlightRanks?: number[];
  successText?: string;
  failText?: string;
  /** weakness tag for mistake clustering */
  tag?: string;
  /** "quiz" steps */
  question?: string;
  options?: QuizOption[];
  correct?: number;
  explain?: string;
  visual?: PreschoolVisual;
  /** optional square highlight for visual helpers */
  visualSquare?: string;
  visualSquares?: [string, string];
}

export interface Lesson {
  id: string;
  unit: string;
  title: string;
  subtitle: string;
  emoji: string;
  /** lesson ids that must be mastered first */
  prerequisites: string[];
  xp: number;
  tag: string;
  /** a class exam — passing it graduates the whole class */
  exam?: boolean;
  steps: LessonStep[];
}

export interface Unit {
  id: string;
  title: string;
  blurb: string;
  color: string;
  lessonIds: string[];
}
