import { describe, expect, it } from "vitest";
import {
  buildMatchGreeting,
  buildMoveComment,
  buildRecapEpilogue,
  buildThinkingGreeting,
} from "./botVoice";
import { commentOnMatchMove, matchGreeting, passPlayGreeting } from "./matchCommentary";
import type { VerboseMove } from "@/core/types/chess";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
    const capture = move({
      san: "Bxf7+",
      captured: "p",
      flags: "c",
      piece: "b",
      from: "c4",
      to: "f7",
    });
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
    expect(bot).toMatch(/Cody|your/i);
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
    expect(line).toMatch(/Sasha/i);
  });

  it("pass-and-play greeting follows personality", () => {
    expect(passPlayGreeting("minimal")).toMatch(/pass|play|board|move/i);
    expect(passPlayGreeting("friendly")).toMatch(/fun|board|human/i);
  });
});

describe("botVoice matrix", () => {
  it("same bot + different coach personalities produce different greetings", () => {
    const friendly = buildMatchGreeting(900, "Remi", "friendly", false);
    const strict = buildMatchGreeting(900, "Remi", "strict", false);
    expect(friendly).toMatch(/Remi/i);
    expect(strict).toMatch(/Remi/i);
    expect(friendly).not.toBe(strict);
  });

  it("same personality + different bots produce different greetings", () => {
    const pip = buildMatchGreeting(500, "Pip", "mentor", false);
    const titan = buildMatchGreeting(2500, "Titan", "mentor", false);
    expect(pip).toMatch(/Pip/i);
    expect(titan).toMatch(/Titan/i);
    expect(pip).not.toBe(titan);
  });

  it("move comments name the bot and vary by personality", () => {
    const capture = move({
      san: "Bxf7",
      captured: "p",
      flags: "c",
      piece: "b",
      from: "c4",
      to: "f7",
    });
    const ctx = {
      botName: "Vera",
      botElo: 1800,
      reactingToPlayer: false,
      moveNumber: 20,
      move: capture,
    };
    const friendly = buildMoveComment(
      { ...ctx, personality: "friendly" },
      "capture_pawn",
    );
    const strict = buildMoveComment({ ...ctx, personality: "strict" }, "capture_pawn");
    expect(friendly).toMatch(/Vera/i);
    expect(strict).toMatch(/Vera/i);
    expect(friendly).not.toBe(strict);
  });

  it("recap epilogue references the bot by name", () => {
    const win = buildRecapEpilogue("Magnus Jr.", "tactical", "master", true, 42);
    const loss = buildRecapEpilogue("Magnus Jr.", "tactical", "master", false, 42);
    expect(win).toMatch(/Magnus Jr\./i);
    expect(loss).toMatch(/Magnus Jr\./i);
    expect(win).not.toBe(loss);
  });

  it("thinking greeting blends bot and coach voice", () => {
    const line = buildThinkingGreeting(1200, "Sasha", "strict");
    expect(line).toMatch(/Sasha/i);
    expect(line.length).toBeGreaterThan(20);
  });
});
