import { describe, expect, it } from "vitest";
import {
  buildClassExamSteps,
  classExamHasMinSteps,
  filterExamMoveSteps,
  isExamMoveStep,
  isTutorialLesson,
  pickSchoolExamSteps,
  sampleExamSteps,
  scoredStepCount,
  shuffleInPlace,
} from "./classExam";
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
            options: [{ label: "a", emoji: "" }],
            correct: 0,
            explain: "x",
            failText: "y",
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
            options: [{ label: "b", emoji: "" }],
            correct: 1,
            explain: "x",
            failText: "y",
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
          {
            id: "q1",
            kind: "quiz",
            coach: "",
            question: "?",
            options: [],
            correct: 0,
          },
        ] satisfies LessonStep[]),
      },
    ];
    const steps = buildClassExamSteps(teaching);
    expect(steps).toHaveLength(1);
    expect(steps[0]?.kind).toBe("move");
  });

  it("pulls move puzzles from the whole class when the last two lessons are thin", () => {
    const move = {
      id: "m",
      kind: "move" as const,
      coach: "Find the move.",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      solution: ["e2:e4"],
    };
    const teaching = [
      { steps: JSON.stringify([move, move, move]) },
      { steps: JSON.stringify([{ id: "i", kind: "info", coach: "read" }]) },
      { steps: JSON.stringify([{ id: "i2", kind: "info", coach: "read" }]) },
    ];
    const steps = buildClassExamSteps(teaching, 5);
    expect(steps.filter((s) => s.kind === "move")).toHaveLength(3);
  });
});

describe("isExamMoveStep", () => {
  it("requires exactly one solution ply", () => {
    expect(
      isExamMoveStep({
        id: "a",
        kind: "move",
        coach: "x",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        solution: ["e2:e4", "e7:e5"],
      }),
    ).toBe(false);
    expect(
      isExamMoveStep({
        id: "b",
        kind: "move",
        coach: "x",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        solution: ["e2:e4"],
      }),
    ).toBe(true);
  });
});

describe("pickSchoolExamSteps", () => {
  it("returns only single-move puzzles and respects count", () => {
    const pool: LessonStep[] = [
      {
        id: "1",
        kind: "move",
        coach: "x",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        solution: ["e2:e4"],
      },
      {
        id: "2",
        kind: "move",
        coach: "x",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        solution: ["d2:d4", "d7:d5"],
      },
      {
        id: "3",
        kind: "move",
        coach: "x",
        fen: "8/8/8/8/8/8/8/8 w - - 0 1",
        solution: ["g1:f3"],
      },
    ];
    const picked = pickSchoolExamSteps(pool, 2, () => 0.5);
    expect(picked).toHaveLength(2);
    expect(filterExamMoveSteps(pool)).toHaveLength(2);
  });
});

describe("shuffleInPlace", () => {
  it("is deterministic with a fixed rng sequence", () => {
    const vals = [0.5, 0.99, 0.25, 0.25];
    const makeRng = () => {
      let i = 0;
      return () => vals[i++ % vals.length]!;
    };
    const a = shuffleInPlace([1, 2, 3, 4], makeRng());
    const b = shuffleInPlace([1, 2, 3, 4], makeRng());
    expect(a).toEqual(b);
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

describe("classExamHasMinSteps", () => {
  it("needs at least two scored steps", () => {
    expect(classExamHasMinSteps([{ id: "q", kind: "quiz" } as LessonStep])).toBe(false);
    expect(
      classExamHasMinSteps([
        { id: "a", kind: "quiz" },
        { id: "b", kind: "quiz" },
      ] as LessonStep[]),
    ).toBe(true);
  });
});

describe("sampleExamSteps", () => {
  it("evenly samples long lists", () => {
    const arr = Array.from({ length: 10 }, (_, i) => i);
    expect(sampleExamSteps(arr, 5)).toEqual([0, 2, 4, 6, 8]);
  });
});
