import { describe, expect, it } from "vitest";
import { buildMatchRecap } from "./gameRecap";
import type { VerboseMove } from "@/core/types/chess";

function move(san: string, color: "w" | "b" = "w", captured?: string): VerboseMove {
  return {
    color,
    from: "e2",
    to: "e4",
    piece: "p",
    san,
    flags: captured ? "c" : "b",
    captured: captured as VerboseMove["captured"],
  };
}

describe("buildMatchRecap", () => {
  it("mentions the bot on a win", () => {
    const line = buildMatchRecap({
      history: [move("e4"), move("e5", "b"), move("Qh5#")],
      personality: "genz",
      botElo: 600,
      botName: "Cody",
      playerColor: "w",
      playerWon: true,
      reason: "checkmate",
    });
    expect(line).toMatch(/Cody/i);
    expect(line.length).toBeGreaterThan(20);
  });

  it("varies by personality", () => {
    const history = Array.from({ length: 24 }, (_, i) =>
      move(i % 2 === 0 ? "e4" : "e5", i % 2 === 0 ? "w" : "b"),
    );
    const genz = buildMatchRecap({
      history,
      personality: "genz",
      botElo: 2000,
      botName: "Vera",
      playerColor: "w",
      playerWon: false,
      reason: "checkmate",
    });
    const sassy = buildMatchRecap({
      history,
      personality: "sassy",
      botElo: 2000,
      botName: "Vera",
      playerColor: "w",
      playerWon: false,
      reason: "checkmate",
    });
    expect(genz).not.toBe(sassy);
    expect(sassy.length).toBeLessThan(genz.length);
  });
});
