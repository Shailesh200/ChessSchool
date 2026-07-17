import { describe, expect, it } from "vitest";
import {
  firstMoveStep,
  moveMatchesSolution,
  moveKey,
  pickIndex,
  puzzleFromStep,
} from "./calculationPuzzle";
import type { LessonStep } from "@/features/lessons/types";

describe("calculationPuzzle", () => {
  it("matches solution keys", () => {
    expect(moveMatchesSolution({ from: "e2", to: "e4" }, ["e2:e4", "d2:d4"])).toBe(
      true,
    );
    expect(moveMatchesSolution({ from: "d2", to: "d4" }, ["e2:e4"])).toBe(false);
    expect(moveKey({ from: "a1", to: "a8" })).toBe("a1:a8");
  });

  it("picks deterministically from seed", () => {
    expect(pickIndex(10, "abc")).toBe(pickIndex(10, "abc"));
    expect(pickIndex(10, "abc")).not.toBe(pickIndex(10, "xyz"));
  });

  it("extracts first move step", () => {
    const steps: LessonStep[] = [
      { id: "i", kind: "info", coach: "Hi" },
      {
        id: "m",
        kind: "move",
        coach: "Find the tactic",
        fen: "start",
        solution: ["e2:e4"],
      },
    ];
    const hit = firstMoveStep(steps);
    expect(hit?.index).toBe(1);
    const puzzle = puzzleFromStep(
      { id: "hw-1", title: "Drill", tag: "fork", emoji: "🎯" },
      hit!.index,
      hit!.step,
    );
    expect(puzzle?.solutionKey).toBe("e2:e4");
  });
});
