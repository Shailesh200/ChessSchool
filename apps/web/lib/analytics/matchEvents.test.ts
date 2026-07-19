import { describe, expect, it } from "vitest";
import { outcomeFromWinner, passOutcome } from "@/lib/analytics/matchEvents";

describe("match outcome helpers", () => {
  it("maps player-centric win/loss/draw", () => {
    expect(outcomeFromWinner("w", "w")).toBe("win");
    expect(outcomeFromWinner("b", "w")).toBe("loss");
    expect(outcomeFromWinner(null, "w")).toBe("draw");
  });

  it("maps pass-and-play side results", () => {
    expect(passOutcome("w")).toBe("white_win");
    expect(passOutcome("b")).toBe("black_win");
    expect(passOutcome(null)).toBe("draw");
  });
});
