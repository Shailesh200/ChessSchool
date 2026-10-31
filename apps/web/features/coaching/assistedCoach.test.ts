import { Chess } from "chess.js";
import { describe, expect, it } from "vitest";
import {
  agreeMoveVerb,
  explainAssistedBotReply,
  explainAssistedPlayerMove,
} from "./assistedCoach";

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
      personality: "genz",
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
      personality: "genz",
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
      personality: "anxious_nerd",
    });
    expect(line.length).toBeGreaterThan(40);
    expect(line).not.toMatch(/reply/i);
  });

  it("uses second-person grammar for the student pawn headline", () => {
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
    expect(line).not.toMatch(/You plays/);
  });
});

describe("FL-036 move headline agreement", () => {
  const phrases = ["play", "move", "capture", "castle", "promote"] as const;

  it("uses the base verb for You and the -s form for a third person", () => {
    for (const verb of phrases) {
      expect(agreeMoveVerb("You", verb)).toBe(verb);
      expect(agreeMoveVerb(" you ", verb)).toBe(verb);
      expect(agreeMoveVerb("Kira", verb)).toBe(`${verb}s`);
    }
  });

  function played(fen: string, from: string, to: string, promotion?: "q") {
    const chess = new Chess(fen);
    const move = chess.move({ from, to, promotion });
    expect(move).toBeTruthy();
    return { move: move!, afterFen: chess.fen() };
  }

  function playerLine(fen: string, from: string, to: string, promotion?: "q") {
    const { move, afterFen } = played(fen, from, to, promotion);
    return explainAssistedPlayerMove({
      beforeFen: fen,
      move,
      afterFen,
      inCheckAfter: false,
      moveNumber: 8,
      playerRating: 1400,
      botName: "Kira",
      personality: "genz",
    });
  }

  function botLine(fen: string, from: string, to: string, promotion?: "q") {
    const { move, afterFen } = played(fen, from, to, promotion);
    return explainAssistedBotReply({
      beforeFen: fen,
      move,
      afterFen,
      botName: "Kira",
      playerRating: 1400,
      personality: "genz",
      moveNumber: 8,
    });
  }

  it("says You play the pawn after e2-e4 and Kira plays for the bot", () => {
    const yours = playerLine(START, "e2", "e4");
    expect(yours).toContain("You play the pawn from e2 to e4");
    expect(yours).not.toContain("You plays");

    const afterE4 = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const theirs = botLine(afterE4, "e7", "e5");
    expect(theirs).toContain("Kira plays the pawn from e7 to e5");
    expect(theirs).not.toMatch(/Kira play /);
  });

  it("agrees move, capture, castle, promote, and en passant for both subjects", () => {
    expect(playerLine(START, "g1", "f3")).toContain(
      "You move the knight from g1 to f3",
    );
    expect(playerLine(START, "g1", "f3")).not.toContain("You moves");

    const blackKnight = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    expect(botLine(blackKnight, "g8", "f6")).toContain(
      "Kira moves the knight from g8 to f6",
    );

    const captureFen = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
    expect(playerLine(captureFen, "e4", "d5")).toContain(
      "You capture the pawn on d5 with the pawn from e4",
    );
    const botCapture = "rnbqkbnr/ppp2ppp/8/3pp3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 3";
    // Black to move is required for the bot capture; flip the turn.
    const blackCapture = botCapture.replace(" w ", " b ");
    expect(botLine(blackCapture, "d5", "e4")).toContain(
      "Kira captures the pawn on e4 with the pawn from d5",
    );

    const castleFen = "r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1";
    expect(playerLine(castleFen, "e1", "g1")).toContain("You castle kingside");
    expect(playerLine(castleFen, "e1", "g1")).not.toContain("You castles");
    const botCastle = "r3k2r/8/8/8/8/8/8/4K3 b kq - 0 1";
    expect(botLine(botCastle, "e8", "g8")).toContain("Kira castles kingside");

    const promoFen = "8/P7/8/8/8/8/8/4k2K w - - 0 1";
    expect(playerLine(promoFen, "a7", "a8", "q")).toContain(
      "You promote the pawn on a8 to a queen",
    );
    const botPromo = "4k3/8/8/8/8/8/p7/4K3 b - - 0 1";
    expect(botLine(botPromo, "a2", "a1", "q")).toContain(
      "Kira promotes the pawn on a1 to a queen",
    );

    const epFen = "rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3";
    expect(playerLine(epFen, "e5", "d6")).toContain("You capture en passant on d6");
    const botEp = "rnbqkbnr/pppp1ppp/8/4p3/3Pp3/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 3";
    expect(botLine(botEp, "e4", "d3")).toContain("Kira captures en passant on d3");
  });
});
