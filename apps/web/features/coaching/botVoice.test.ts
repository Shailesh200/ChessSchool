import { describe, expect, it } from "vitest";
import {
  buildMatchGreeting,
  buildMoveComment,
  buildRecapEpilogue,
  buildThinkingGreeting,
  passPlayGreeting,
} from "./botVoice";
import type { VerboseMove } from "@/core/types/chess";

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

describe("botVoice", () => {
  it("greets each bot with distinct copy", () => {
    const pip = buildMatchGreeting(450, "Pip", "genz", false);
    const titan = buildMatchGreeting(2500, "Titan", "genz", false);
    expect(pip).toMatch(/Pip/i);
    expect(titan).toMatch(/Titan/i);
    expect(pip).not.toBe(titan);
  });

  it("varies move commentary by personality for the same bot", () => {
    const capture = move({
      san: "Bxf7",
      captured: "p",
      flags: "c",
      piece: "b",
      from: "c4",
      to: "f7",
    });
    const ctx = {
      botName: "Cody",
      botElo: 800,
      reactingToPlayer: false,
      moveNumber: 12,
      move: capture,
    };
    const genz = buildMoveComment({ ...ctx, personality: "genz" }, "capture_pawn");
    const sarcastic = buildMoveComment(
      { ...ctx, personality: "sarcastic" },
      "capture_pawn",
    );
    expect(genz).toMatch(/Cody/i);
    expect(sarcastic).toMatch(/Cody/i);
    expect(genz).not.toBe(sarcastic);
  });

  it("recap epilogue names the bot", () => {
    const line = buildRecapEpilogue("Remi", "anxious_nerd", "club", true, 7);
    expect(line).toMatch(/Remi/i);
  });

  it("thinking greeting references the opponent", () => {
    const line = buildThinkingGreeting(1100, "Sasha", "egoistic");
    expect(line).toMatch(/Sasha/i);
  });

  it("pass-and-play greetings differ by personality", () => {
    expect(passPlayGreeting("genz")).not.toBe(passPlayGreeting("sassy"));
  });
});
