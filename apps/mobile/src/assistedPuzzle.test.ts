import { describe, expect, it } from "vitest";
import { matchesSolution } from "@chess-school/progression";
import { assistedEngineMove, assistedMoveOk } from "./assistedPuzzle";

describe("assisted play promotion", () => {
  it("plays the piece the student chose in free play and in the puzzle drill", () => {
    expect(assistedEngineMove("e7", "e8", "n")).toEqual({
      from: "e7",
      to: "e8",
      promotion: "n",
    });
    expect(assistedEngineMove("c2", "c1", "r").promotion).toBe("r");
    expect(assistedEngineMove("a7", "a8", "b").promotion).toBe("b");
    expect(assistedEngineMove("e2", "e4").promotion).toBe("q");
  });

  it("grades the puzzle drill with matchesSolution, so a queen fails an underpromotion", () => {
    const puzzle = { allSolutions: ["c2:c1"], promotion: "n" as const };
    const knight = assistedEngineMove("c2", "c1", "n");
    const queen = assistedEngineMove("c2", "c1", "q");
    expect(assistedMoveOk(puzzle, knight)).toBe(
      matchesSolution(
        { solution: puzzle.allSolutions, promotion: puzzle.promotion },
        knight,
      ),
    );
    expect(assistedMoveOk(puzzle, queen)).toBe(false);
    expect(assistedMoveOk(puzzle, knight)).toBe(true);
  });
});

describe("assistedMoveOk", () => {
  it("rejects a queen on an underpromotion and accepts the named piece", () => {
    const puzzle = { allSolutions: ["c2:c1"], promotion: "n" as const };
    expect(assistedMoveOk(puzzle, { from: "c2", to: "c1", promotion: "q" })).toBe(
      false,
    );
    expect(assistedMoveOk(puzzle, { from: "c2", to: "c1", promotion: "n" })).toBe(true);
    expect(assistedMoveOk(puzzle, { from: "c2", to: "c1" })).toBe(false);
  });

  it("rejects a knight on a promote-to-queen step", () => {
    const puzzle = { allSolutions: ["e7:e8"], promotion: "q" as const };
    expect(assistedMoveOk(puzzle, { from: "e7", to: "e8", promotion: "n" })).toBe(
      false,
    );
    expect(assistedMoveOk(puzzle, { from: "e7", to: "e8", promotion: "q" })).toBe(true);
  });

  it("stays lenient when the puzzle does not name a piece", () => {
    const puzzle = { allSolutions: ["e2:e4"] };
    expect(assistedMoveOk(puzzle, { from: "e2", to: "e4", promotion: "q" })).toBe(true);
    expect(assistedMoveOk(puzzle, { from: "e2", to: "e4" })).toBe(true);
    expect(assistedMoveOk(puzzle, { from: "d2", to: "d4", promotion: "q" })).toBe(
      false,
    );
  });

  it("uses the per-move map when solutions promote to different pieces", () => {
    const puzzle = {
      allSolutions: ["e7:e8", "a7:a8"],
      promotions: { "e7:e8": "q" as const, "a7:a8": "n" as const },
    };
    expect(assistedMoveOk(puzzle, { from: "e7", to: "e8", promotion: "q" })).toBe(true);
    expect(assistedMoveOk(puzzle, { from: "e7", to: "e8", promotion: "n" })).toBe(
      false,
    );
    expect(assistedMoveOk(puzzle, { from: "a7", to: "a8", promotion: "n" })).toBe(true);
    expect(assistedMoveOk(puzzle, { from: "a7", to: "a8", promotion: "q" })).toBe(
      false,
    );
  });
});
