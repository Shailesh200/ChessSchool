import { describe, expect, it } from "vitest";
import { assistedMoveOk } from "./assistedPuzzle";

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
