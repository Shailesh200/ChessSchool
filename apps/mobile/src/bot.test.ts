import { describe, it, expect } from "vitest";
import { chooseMove, eloToConfig } from "@chess-school/core";

const uci = (fen: string, elo = 1900, seed = 0.5) => {
  const m = chooseMove(fen, eloToConfig(elo), seed);
  return m ? `${m.from}${m.to}${m.promotion ?? ""}` : null;
};

describe("bot engine quality", () => {
  it("opens from the book", () => {
    const u = uci("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(["e2e4", "d2d4", "g1f3", "c2c4"]).toContain(u);
  });

  it("captures a hanging queen (quiescence finds it)", () => {
    // black queen on d4 is undefended; white pawn e3 can take it.
    expect(uci("4k3/8/8/8/3q4/4P3/8/4K3 w - - 0 1")).toBe("e3d4");
  });

  it("finds a back-rank mate-in-1", () => {
    expect(uci("6k1/5ppp/8/8/8/8/8/R3K3 w - - 0 1")).toBe("a1a8");
  });

  it("returns a sound move FAST in a complex middlegame (bounded think)", () => {
    const t0 = Date.now();
    const u = uci("r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 0 1");
    const ms = Date.now() - t0;
    expect(u).toBeTruthy();
    expect(ms).toBeLessThan(2500); // must stay responsive on a phone (no 70s freezes)
  }, 6000);

  it("returns null only when there are no legal moves (stalemate)", () => {
    expect(uci("k7/8/1Q6/8/8/8/8/7K b - - 0 1")).toBeNull(); // black stalemated
  });

  it("weaker bots still make legal, non-null moves", () => {
    for (const elo of [400, 700, 1000, 1300]) {
      expect(uci("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1", elo, 0.3)).toBeTruthy();
    }
  });
});
