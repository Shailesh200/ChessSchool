import { describe, expect, it } from "vitest";
import { framesFromHistory, lastMoveFrames, lastMoveFramesFromHistory, replayFrames } from "./replay";

describe("lastMoveFrames", () => {
  it("returns trailing frames plus the position before the first replayed move", () => {
    // Scholar's mate line (4 moves)
    const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#";
    const tail = lastMoveFrames(pgn, 5);
    expect(tail).toHaveLength(6);
    expect(tail[0]?.san).toBe("e5");
    expect(tail[tail.length - 1]?.mate).toBe(true);
    expect(tail[tail.length - 1]?.san).toMatch(/f7/);
  });

  it("builds mate frames from verbose history without PGN", () => {
    const moves = [
      { from: "e2" as const, to: "e4" as const, san: "e4" },
      { from: "e7" as const, to: "e5" as const, san: "e5" },
      { from: "f1" as const, to: "c4" as const, san: "Bc4" },
      { from: "b8" as const, to: "c6" as const, san: "Nc6" },
      { from: "d1" as const, to: "h5" as const, san: "Qh5" },
      { from: "g8" as const, to: "f6" as const, san: "Nf6" },
      { from: "h5" as const, to: "f7" as const, san: "Qxf7#" },
    ];
    const tail = lastMoveFramesFromHistory(moves, 5);
    expect(tail[tail.length - 1]?.mate).toBe(true);
    expect(framesFromHistory(moves).at(-1)?.san).toBe("Qxf7#");
  });
});
