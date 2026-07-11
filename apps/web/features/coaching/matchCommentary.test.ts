import { describe, expect, it } from "vitest";
import { commentOnMatchMove, matchGreeting, passPlayGreeting } from "./matchCommentary";
import type { VerboseMove } from "@/core/types/chess";

const START =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

function move(overrides: Partial<VerboseMove> & Pick<VerboseMove, "san">): VerboseMove {
  return {
    color: "w",
    from: "e2",
    to: "e4",
    piece: "p",
    flags: "b",
    ...overrides,
  };
}

describe("matchCommentary", () => {
  it("varies greetings by bot tier", () => {
    const pip = matchGreeting(450, "Pip", false, "friendly");
    const titan = matchGreeting(2500, "Titan", false, "friendly");
    expect(pip).toMatch(/Pip/i);
    expect(titan).toMatch(/Titan/i);
    expect(pip).not.toBe(titan);
  });

  it("reacts differently when the player moves vs the bot", () => {
    const capture = move({ san: "Bxf7+", captured: "p", flags: "c", piece: "b", from: "c4", to: "f7" });
    const player = commentOnMatchMove({
      beforeFen: START,
      move: capture,
      botElo: 800,
      botName: "Cody",
      personality: "friendly",
      reactingToPlayer: true,
      moveNumber: 5,
    });
    const bot = commentOnMatchMove({
      beforeFen: START,
      move: capture,
      botElo: 800,
      botName: "Cody",
      personality: "friendly",
      reactingToPlayer: false,
      moveNumber: 5,
    });
    expect(player).toMatch(/you/i);
    expect(bot).toMatch(/I|your/i);
    expect(player).not.toBe(bot);
  });

  it("detects checkmate lines", () => {
    const mate = move({ san: "Qh7#", flags: "c", piece: "q", from: "h5", to: "h7" });
    const line = commentOnMatchMove({
      beforeFen: START,
      move: mate,
      botElo: 1500,
      botName: "Sasha",
      personality: "tactical",
      reactingToPlayer: false,
      moveNumber: 40,
    });
    expect(line.toLowerCase()).toMatch(/mate|checkmate/);
  });

  it("pass-and-play greeting follows personality", () => {
    expect(passPlayGreeting("minimal").length).toBeLessThan(20);
    expect(passPlayGreeting("friendly")).toMatch(/fun|luck|board/i);
  });
});
