import { describe, expect, it } from "vitest";
import { explainAssistedBotReply, explainAssistedPlayerMove } from "./assistedCoach";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("assistedCoach", () => {
  it("explains a central pawn move with purpose and plan", () => {
    const line = explainAssistedPlayerMove({
      beforeFen: START,
      move: {
        color: "w",
        from: "e2",
        to: "e4",
        piece: "p",
        san: "e4",
        flags: "b",
      },
      afterFen: "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      inCheckAfter: false,
      moveNumber: 1,
      playerRating: 900,
      botName: "Remi",
      personality: "friendly",
    });
    expect(line.toLowerCase()).toMatch(/pawn/);
    expect(line.toLowerCase()).toMatch(/centre|center/);
    expect(line).not.toMatch(/reply/i);
  });

  it("does not use Reply template for opponent moves", () => {
    const before = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const line = explainAssistedBotReply({
      beforeFen: before,
      move: {
        color: "b",
        from: "a7",
        to: "a5",
        piece: "p",
        san: "a5",
        flags: "n",
      },
      afterFen: "rnbqkbnr/1ppppppp/8/p7/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2",
      botName: "Remi",
      playerRating: 900,
      personality: "friendly",
      moveNumber: 2,
    });
    expect(line).not.toMatch(/reply:/i);
    expect(line).not.toMatch(/find your next idea/i);
    expect(line).toMatch(/Remi/i);
    expect(line).toMatch(/a5/);
    expect(line.toLowerCase()).toMatch(/queenside|flank|side/);
  });

  it("flags an undefended piece when appropriate", () => {
    const before = "rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 2 3";
    const line = explainAssistedPlayerMove({
      beforeFen: before,
      move: {
        color: "b",
        from: "b8",
        to: "c6",
        piece: "n",
        san: "Nc6",
        flags: "n",
      },
      afterFen: "r1bqkb1r/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 3 3",
      inCheckAfter: false,
      moveNumber: 4,
      playerRating: 600,
      botName: "Remi",
      personality: "mentor",
    });
    expect(line.length).toBeGreaterThan(40);
    expect(line).not.toMatch(/reply/i);
  });
});
