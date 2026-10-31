import { describe, expect, it } from "vitest";
import { stripLessonStepsForClient, verifyLessonStepAnswer } from "./lesson-public";
import type { LessonStep } from "@/features/lessons/types";

describe("lesson-public", () => {
  it("strips solutions from API-facing steps", () => {
    const steps: LessonStep[] = [
      {
        id: "m1",
        kind: "move",
        coach: "Find the mate",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        solution: ["e2:e4"],
      },
    ];
    const stripped = stripLessonStepsForClient(steps);
    expect(stripped[0]?.solution).toBeUndefined();
    expect(stripped[0]?.coach).toBe("Find the mate");
  });

  it("checks move answers server-side", () => {
    const step: LessonStep = {
      id: "m1",
      kind: "move",
      coach: "Push the pawn",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: ["e2:e4"],
    };
    expect(
      verifyLessonStepAnswer(step, { kind: "move", from: "e2", to: "e4" }),
    ).toBe(true);
    expect(
      verifyLessonStepAnswer(step, { kind: "move", from: "d2", to: "d4" }),
    ).toBe(false);
  });
});
