import type { BoardArrow, Square } from "@/core/types/chess";

/**
 * Lesson step kinds — the school flow is Learn → Observe → Try → Master, with
 * no quiz/questionnaire steps:
 *  - "info":    explanation on a static board
 *  - "observe": an auto-played example line the student watches
 *  - "move":    the student must find the correct move
 */
export type StepKind = "info" | "observe" | "move";

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
  successText?: string;
  failText?: string;
  /** weakness tag for mistake clustering */
  tag?: string;
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
