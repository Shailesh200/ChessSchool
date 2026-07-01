import { describe, it, expect } from "vitest";
import { eloToUci, parseBestMove } from "./stockfish";

describe("eloToUci", () => {
  it("uses UCI_Elo at/above the engine floor (1320)", () => {
    const opts = eloToUci(1500);
    expect(opts).toContain("setoption name UCI_LimitStrength value true");
    expect(opts).toContain("setoption name UCI_Elo value 1500");
  });
  it("uses Skill Level below the floor", () => {
    const opts = eloToUci(600);
    expect(opts[0]).toBe("setoption name UCI_LimitStrength value false");
    expect(opts[1]).toMatch(/^setoption name Skill Level value \d+$/);
  });
  it("clamps to the engine's strength range", () => {
    expect(eloToUci(5000)).toContain("setoption name UCI_Elo value 2850");
    const low = eloToUci(100)[1]!;
    expect(low).toBe("setoption name Skill Level value 0");
  });
  it("Skill Level scales 0→20 across 300→~1320", () => {
    expect(eloToUci(300)[1]).toBe("setoption name Skill Level value 0");
    expect(Number(eloToUci(800)[1]!.split(" ").pop())).toBeGreaterThan(0);
    expect(Number(eloToUci(1300)[1]!.split(" ").pop())).toBeLessThanOrEqual(20);
  });
});

describe("parseBestMove", () => {
  it("parses a normal move", () => {
    expect(parseBestMove("bestmove e2e4 ponder e7e5")).toEqual({ from: "e2", to: "e4", promotion: undefined });
  });
  it("parses a promotion", () => {
    expect(parseBestMove("bestmove e7e8q")).toEqual({ from: "e7", to: "e8", promotion: "q" });
  });
  it("returns null for (none) and garbage", () => {
    expect(parseBestMove("bestmove (none)")).toBeNull();
    expect(parseBestMove("info depth 12 score cp 30")).toBeNull();
    expect(parseBestMove("bestmove e2")).toBeNull();
  });
  it("tolerates leading/trailing whitespace", () => {
    expect(parseBestMove("  bestmove g1f3  ")).toEqual({ from: "g1", to: "f3", promotion: undefined });
  });
});
