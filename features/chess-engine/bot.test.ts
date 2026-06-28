import { describe, it, expect } from "vitest";
import { chooseMove, eloToConfig } from "./bot";
import { Chess } from "chess.js";

describe("bot", () => {
  it("maps ELO to deeper search at higher ratings", () => {
    expect(eloToConfig(600).depth).toBeLessThan(eloToConfig(2000).depth);
    expect(eloToConfig(600).blunderChance).toBeGreaterThan(eloToConfig(2000).blunderChance);
  });

  it("returns a legal move from the start position", () => {
    const fen = new Chess().fen();
    const move = chooseMove(fen, eloToConfig(1200), 0.5);
    expect(move).not.toBeNull();
    const g = new Chess(fen);
    expect(g.move({ from: move!.from, to: move!.to, promotion: "q" })).toBeTruthy();
  });

  it("takes free material — captures a hanging queen", () => {
    // White to move; black queen on d5 is defended by nothing, white pawn e4 can take.
    const move = chooseMove("4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1", eloToConfig(2000), 0.5);
    expect(move).toEqual({ from: "e4", to: "d5", promotion: undefined });
  });

  it("returns null when there are no legal moves (checkmate)", () => {
    const move = chooseMove("rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3", eloToConfig(1200), 0.5);
    expect(move).toBeNull();
  });
});
