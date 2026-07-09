import { describe, expect, it } from "vitest";
import { lastMoveFrames, replayFrames } from "./replay";

describe("lastMoveFrames", () => {
  it("returns at most 5 trailing move frames", () => {
    // Scholar's mate line (4 moves)
    const pgn = "1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6 4. Qxf7#";
    const tail = lastMoveFrames(pgn, 5);
    expect(tail).toHaveLength(5);
    expect(tail[tail.length - 1]?.mate).toBe(true);
    expect(tail[tail.length - 1]?.san).toMatch(/f7/);
  });
});
