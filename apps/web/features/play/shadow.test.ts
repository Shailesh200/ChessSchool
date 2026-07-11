import { describe, expect, it } from "vitest";
import { inferPlayerColor, opponentMoves, shadowFromGame } from "./shadow";
import type { SavedGame } from "@/core/db/db";

const SAMPLE_PGN = `[Event "?"]
[Site "?"]
[Date "????.??.??"]
[Round "?"]
[White "You"]
[Black "Cody (600)"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 3. Bb5 1-0`;

function game(over: Partial<SavedGame> = {}): SavedGame {
  return {
    id: "g1",
    mode: "bot",
    pgn: SAMPLE_PGN,
    fen: "start",
    whiteName: "You",
    blackName: "Cody (600)",
    createdAt: 1,
    updatedAt: 1,
    turn: "w",
    result: "1-0",
    endReason: "checkmate",
    winner: "w",
    moveCount: 5,
    elo: 600,
    durationMs: 1000,
    ...over,
  };
}

describe("shadow", () => {
  it("infers player color for bot games", () => {
    expect(inferPlayerColor(game())).toBe("w");
  });

  it("extracts opponent moves from PGN", () => {
    const moves = opponentMoves(SAMPLE_PGN, "w");
    expect(moves.map((m) => `${m.from}${m.to}`)).toEqual(["e7e5", "b8c6"]);
  });

  it("builds shadow config", () => {
    const cfg = shadowFromGame(game());
    expect(cfg?.playerColor).toBe("w");
    expect(cfg?.opponentName).toMatch(/Cody/);
  });
});
