import { describe, expect, it } from "vitest";
import {
  pickSchoolExamSteps,
  SCHOOL_EXAM_STEP_COUNT,
} from "@/features/school/classExam";
import type { LessonStep } from "@/features/lessons/types";

describe("school exam step picker", () => {
  it("returns at most eight single-move puzzles", () => {
    const pool: LessonStep[] = Array.from({ length: 20 }, (_, i) => ({
      id: `p${i}`,
      kind: "move" as const,
      coach: "Find the best move.",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: [`e${2 + (i % 4)}:e${4 + (i % 4)}`],
    }));
    const picked = pickSchoolExamSteps(pool, SCHOOL_EXAM_STEP_COUNT, () => 0.25);
    expect(picked.length).toBe(SCHOOL_EXAM_STEP_COUNT);
    expect(picked.every((s) => s.solution?.length === 1)).toBe(true);
  });
});
