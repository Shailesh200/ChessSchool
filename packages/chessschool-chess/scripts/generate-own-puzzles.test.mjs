import { describe, expect, it } from "vitest";
import { checkThemes, dedupeLineage, gapBetween, ratePuzzle, selectFullPack, selectPuzzles, tagThemes, uniqueTactic } from "./generate-own-puzzles.mjs";

describe("own puzzle tags", () => {
  it("accepts the built-in theme fixtures and rating order", () => {
    expect(() => checkThemes()).not.toThrow();
  });

  it("treats a mate as unique only when the alternative does not also win", () => {
    const mate = { move: "a1a8", mate: 1, cp: null };
    const alsoWinning = { move: "a1b1", mate: null, cp: 400 };
    const losing = { move: "a1b1", mate: null, cp: 20 };
    expect(uniqueTactic(mate, alsoWinning)).toBeNull();
    expect(uniqueTactic(mate, losing)).toBe("win");
    expect(gapBetween(mate, losing)).toBeGreaterThanOrEqual(150);
  });

  it("rates a one-move capture below a quiet two-move idea, inside 400–1999", () => {
    const easy = ratePuzzle({ solverPlies: 1, mate: false, gapCp: 800, quietKey: false, keyIsCheck: false, pieceCount: 24, themes: ["hangingPiece"] });
    const hard = ratePuzzle({ solverPlies: 2, mate: false, gapCp: 180, quietKey: true, keyIsCheck: false, pieceCount: 26, themes: ["sacrifice"] });
    expect(easy).toBeGreaterThanOrEqual(400);
    expect(easy).toBeLessThan(800);
    expect(hard).toBeGreaterThan(1500);
    expect(hard).toBeLessThanOrEqual(1999);
  });

  it("spreads a small pool across themes", () => {
    const picked = selectPuzzles(
      [
        { rating: 480, themes: ["mateIn1"] },
        { rating: 510, themes: ["mateIn1"] },
        { rating: 1100, themes: ["fork"] },
        { rating: 1600, themes: ["pin"] },
      ],
      3,
    );
    expect(new Set(picked.map((p) => p.themes[0])).size).toBe(3);
  });

  it("drops a high rating that was not confirmed at depth 14", () => {
    const low = { fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1", moves: "e1d1 e8d8", rating: 900, themes: ["endgame"], gapCp: 200, minSolverGapCp: 200, verifyDepth: 12, origin: { seed: 1, game: 1, ply: 1 } };
    const unconfirmed = { ...low, moves: "e1d2 e8d7", rating: 1700, gapCp: 140, minSolverGapCp: 140, verifyDepth: 12, origin: { seed: 1, game: 2, ply: 1 } };
    const confirmed = { ...low, moves: "e1e2 e8e7", rating: 1720, gapCp: 140, minSolverGapCp: 140, verifyDepth: 14, origin: { seed: 1, game: 3, ply: 1 } };
    const pack = selectFullPack([low, unconfirmed, confirmed], { target: 5, bucketFloor: 0, themeFloor: 0, defensiveMax: 1 });
    expect(pack.puzzles.map((p) => p.rating).sort((a, b) => a - b)).toEqual([900, 1720]);
  });

  it("drops a later fragment of the same combination", () => {
    const kept = dedupeLineage([
      { origin: { game: 1, ply: 23 }, solverPlies: 2, themes: ["mateIn2"] },
      { origin: { game: 1, ply: 24 }, solverPlies: 1, themes: ["mateIn1"] },
      { origin: { game: 2, ply: 24 }, solverPlies: 1, themes: ["fork"] },
    ]);
    expect(kept.map((p) => p.origin.game)).toEqual([1, 2]);
    expect(kept[0].solverPlies).toBe(2);
  });

  it("tags a promotion line in the app's theme order", () => {
    const tags = tagThemes("4k3/P7/8/8/8/8/8/4K3 b - - 0 1", ["e8d8", "a7a8q"]);
    expect(tags).toContain("promotion");
    expect(tags.indexOf("endgame")).toBeLessThan(tags.indexOf("promotion") === -1 ? 99 : tags.length);
  });
});
