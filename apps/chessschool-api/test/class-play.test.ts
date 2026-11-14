import { describe, expect, it } from "vitest";
import { playMove, roundRobin, standings } from "../src/class-play";

describe("class play helpers", () => {
  it("pairs everyone once in a round robin, odd counts included, with balanced colours", () => {
    for (const n of [3, 4, 5, 8]) {
      const ids = Array.from({ length: n }, (_, i) => `p${i}`);
      const pairs = roundRobin(ids);
      expect(pairs).toHaveLength((n * (n - 1)) / 2);
      expect(new Set(pairs.map((p) => [...p].sort().join())).size).toBe(pairs.length);
      for (const id of ids) {
        const whites = pairs.filter(([w]) => w === id).length;
        expect(Math.abs(whites - (n - 1 - whites))).toBeLessThanOrEqual(2);
      }
    }
  });

  it("scores wins, draws and unfinished games", () => {
    const t = standings([
      { whiteId: "a", blackId: "b", result: "1-0" },
      { whiteId: "b", blackId: "c", result: "1/2-1/2" },
      { whiteId: "c", blackId: "a", result: null },
    ]);
    expect(t.get("a")).toEqual({ points: 1, played: 1 });
    expect(t.get("b")).toEqual({ points: 0.5, played: 2 });
    expect(t.get("c")).toEqual({ points: 0.5, played: 1 });
  });

  it("promotes, detects stalemate and rejects nonsense squares", () => {
    expect(playMove("", "zz", "e4")).toBeNull();
    // 1. e4 ... a race to promotion is long; check a known stalemate line instead (Sam Loyd's 10-move stalemate).
    const loyd = "e3 a5 Qh5 Ra6 Qxa5 h5 h4 Rah6 Qxc7 f6 Qxd7+ Kf7 Qxb7 Qd3 Qxb8 Qh7 Qxc8 Kg6";
    expect(playMove(loyd, "c8", "e6")?.over).toEqual({ result: "1/2-1/2", reason: "stalemate" });
    const promo = playMove("a4 h5 a5 h4 a6 h3 axb7 hxg2", "b7", "a8", "n");
    expect(promo?.moves.endsWith("bxa8=N")).toBe(true);
  });
});
