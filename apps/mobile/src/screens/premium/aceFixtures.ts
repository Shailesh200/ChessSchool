import type { Arrow } from "@/ChessBoard";
import { examPassMark } from "./aceModel";

/** Seeded class-exam frame from 09-class-exam.html (puzzle 4 of 6, knight on d5). */
export const SEEDED_EXAM = {
  classLabel: "Knight forks",
  title: "Win material with a fork",
  /** 0-based index so the header reads “puzzle 4 of 6”. */
  puzzleIndex: 3,
  puzzleTotal: 6,
  fen: "6k1/3q1p1p/8/3N4/8/8/5PPP/6K1 w - - 0 1",
  seedSelection: "d5",
  coachLine:
    "Let's look at this one together. No hints in the exam. Pass mark: 5 of 6.",
} as const;

export function seededExamPassMark(): number {
  return examPassMark(SEEDED_EXAM.puzzleTotal);
}

/**
 * Seeded mistake frame from 10b-fix-mistakes.html.
 * Position after the bad capture: knight on a7, queen on a2.
 * Arrow geometry matches the design overlay (e6 → a2).
 */
export const SEEDED_MISTAKE = {
  /** 1-based position in the queue: “2 of 3”, progress 33%. */
  displayIndex: 2,
  total: 3,
  progressPct: 33,
  fen: "4k3/N4pp1/8/8/8/8/q4PP1/6K1 w - - 0 1",
  highlights: ["a7", "a2"] as string[],
  arrow: { startSquare: "e6", endSquare: "a2", color: "#E11D48" } satisfies Arrow,
  coachLine: "Close. You took the pawn on a7, then Black’s queen took a2 and the fork was gone.",
  nextLabel: "Next: find the better move",
} as const;
