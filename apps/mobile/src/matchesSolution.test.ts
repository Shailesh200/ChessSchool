import { describe, expect, it } from "vitest";
import { matchesSolution, expectedPromotion } from "@chess-school/progression";

describe("matchesSolution", () => {
  it("matches from:to and stays lenient when no piece is declared", () => {
    const step = { solution: ["e2:e4", "d2:d4"] };
    expect(matchesSolution(step, { from: "e2", to: "e4" })).toBe(true);
    expect(matchesSolution(step, { from: "e2", to: "e4", promotion: "q" })).toBe(true);
    expect(matchesSolution(step, { from: "d2", to: "d4" })).toBe(true);
    expect(matchesSolution(step, { from: "e2", to: "e5" })).toBe(false);
    expect(matchesSolution({}, { from: "e2", to: "e4" })).toBe(false);
  });

  it("rejects the wrong piece on a promote-to-queen step", () => {
    const step = { solution: ["e7:e8"], promotion: "q" as const };
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "n" })).toBe(false);
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "r" })).toBe(false);
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "b" })).toBe(false);
    expect(matchesSolution(step, { from: "e7", to: "e8" })).toBe(false);
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "q" })).toBe(true);
    expect(matchesSolution(step, { from: "e7", to: "e7", promotion: "q" })).toBe(false);
  });

  it("accepts an underpromotion only for the named piece", () => {
    const step = { solution: ["c2:c1"], promotion: "n" as const };
    expect(matchesSolution(step, { from: "c2", to: "c1", promotion: "q" })).toBe(false);
    expect(matchesSolution(step, { from: "c2", to: "c1", promotion: "n" })).toBe(true);
  });

  it("uses the per-move map when solutions promote to different pieces", () => {
    const step = {
      solution: ["e7:e8", "a7:a8"],
      promotions: { "e7:e8": "q" as const, "a7:a8": "n" as const },
    };
    expect(expectedPromotion(step, "e7:e8")).toBe("q");
    expect(expectedPromotion(step, "a7:a8")).toBe("n");
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "q" })).toBe(true);
    expect(matchesSolution(step, { from: "e7", to: "e8", promotion: "n" })).toBe(false);
    expect(matchesSolution(step, { from: "a7", to: "a8", promotion: "n" })).toBe(true);
    expect(matchesSolution(step, { from: "a7", to: "a8", promotion: "q" })).toBe(false);
  });

  it("lets the per-move map override a scalar piece", () => {
    const step = {
      solution: ["c2:c1"],
      promotion: "q" as const,
      promotions: { "c2:c1": "n" as const },
    };
    expect(expectedPromotion(step, "c2:c1")).toBe("n");
    expect(matchesSolution(step, { from: "c2", to: "c1", promotion: "q" })).toBe(false);
    expect(matchesSolution(step, { from: "c2", to: "c1", promotion: "n" })).toBe(true);
  });
});
