import { describe, expect, it } from "vitest";
import { explainAssistedPlayerMove } from "@/features/coaching/assistedCoach";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("assistedCoach grammar (UI-W-020)", () => {
  it("uses You play for student pawn moves", () => {
    const line = explainAssistedPlayerMove({
      beforeFen: START,
      move: {
        color: "w",
        from: "d2",
        to: "d4",
        piece: "p",
        san: "d4",
        flags: "b",
      },
      afterFen: "rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq - 0 1",
      inCheckAfter: false,
      moveNumber: 1,
      playerRating: 900,
      botName: "Remi",
      personality: "genz",
    });
    expect(line).toMatch(/You play the pawn/);
  });
});
