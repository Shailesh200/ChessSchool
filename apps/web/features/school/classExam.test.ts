import { describe, expect, it } from "vitest";
import { buildClassExamSteps, isTutorialLesson, scoredStepCount } from "./classExam";
import type { LessonStep } from "@/features/lessons/types";

describe("buildClassExamSteps", () => {
  it("falls back to quiz steps when the class has no move puzzles", () => {
    const teaching = [
      {
        steps: JSON.stringify([
          {
            id: "q1",
            kind: "quiz",
            coach: "",
            question: "A?",
            options: [],
            correct: 0,
          },
        ] satisfies LessonStep[]),
      },
      {
        steps: JSON.stringify([
          {
            id: "q2",
            kind: "quiz",
            coach: "",
            question: "B?",
            options: [],
            correct: 1,
          },
        ] satisfies LessonStep[]),
      },
    ];
    const steps = buildClassExamSteps(teaching);
    expect(steps).toHaveLength(2);
    expect(steps.every((s) => s.kind === "quiz")).toBe(true);
  });

  it("prefers move steps when present", () => {
    const teaching = [
      {
        steps: JSON.stringify([
          {
            id: "m1",
            kind: "move",
            coach: "Play e4.",
            fen: "8/8/8/8/8/8/8/8 w - - 0 1",
            solution: ["e2:e4"],
          },
          { id: "q1", kind: "quiz", coach: "", question: "?", options: [], correct: 0 },
        ] satisfies LessonStep[]),
      },
    ];
    const steps = buildClassExamSteps(teaching);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe("move");
  });
});

describe("isTutorialLesson", () => {
  it("treats exams as scored even when quiz-only", () => {
    expect(isTutorialLesson([{ id: "q", kind: "quiz" } as LessonStep], true)).toBe(
      false,
    );
  });

  it("marks info-only lessons as tutorials", () => {
    expect(isTutorialLesson([{ id: "i", kind: "info" } as LessonStep])).toBe(true);
    expect(scoredStepCount([{ id: "q", kind: "quiz" } as LessonStep])).toBe(1);
  });
});
