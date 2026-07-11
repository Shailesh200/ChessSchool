import { describe, it, expect } from "vitest";
import { chooseMove, eloToConfig } from "./bot";
import { Chess } from "chess.js";

describe("bot", () => {
  it("maps ELO to deeper search at higher ratings", () => {
    expect(eloToConfig(600).depth).toBeLessThan(eloToConfig(2000).depth);
    expect(eloToConfig(600).blunderChance).toBeGreaterThan(
      eloToConfig(2000).blunderChance,
    );
  });

  it("300 ELO uses beginner profile (no book, shallow search)", () => {
    const c = eloToConfig(300);
    expect(c.depth).toBe(0);
    expect(c.useBook).toBe(false);
    expect(c.qMax).toBe(0);
    expect(c.materialOnly).toBe(true);
    expect(c.blunderChance).toBeGreaterThan(0.95);
    expect(c.randomMoveChance).toBeGreaterThan(0.7);
    expect(c.pickWorstChance).toBeGreaterThan(0.65);
  });

  it("600 ELO stays in the weak beginner band (no deep search)", () => {
    const c = eloToConfig(600);
    expect(c.depth).toBeLessThanOrEqual(1);
    expect(c.useBook).toBe(false);
    expect(c.materialOnly).toBe(true);
    expect(c.blunderChance).toBeGreaterThan(0.8);
  });

  it("300 ELO does not always open with book moves", () => {
    const fen = new Chess().fen();
    const move = chooseMove(fen, eloToConfig(300), 0.15);
    expect(move).not.toBeNull();
    const uci = `${move!.from}${move!.to}`;
    expect(["e2e4", "d2d4", "g1f3", "c2c4"]).not.toContain(uci);
  });

  it("300 ELO often misses a hanging queen", () => {
    const fen = "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1";
    let missed = 0;
    for (let i = 0; i < 30; i++) {
      const m = chooseMove(fen, eloToConfig(300), i / 30);
      if (m && `${m.from}${m.to}` !== "e4d5") missed++;
    }
    expect(missed).toBeGreaterThan(26);
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
    const move = chooseMove(
      "4k3/8/8/3q4/4P3/8/8/4K3 w - - 0 1",
      eloToConfig(2000),
      0.5,
    );
    expect(move).toEqual({ from: "e4", to: "d5", promotion: undefined });
  }, 60_000);

  it("returns null when there are no legal moves (checkmate)", () => {
    const move = chooseMove(
      "rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3",
      eloToConfig(1200),
      0.5,
    );
    expect(move).toBeNull();
  });
});
