import { describe, it, expect } from "vitest";
import { ChessEngine } from "./engine";

describe("ChessEngine", () => {
  it("applies a legal move and returns verbose data", () => {
    const e = new ChessEngine();
    const move = e.move({ from: "e2", to: "e4" });
    expect(move).not.toBeNull();
    expect(move?.san).toBe("e4");
    expect(e.turn()).toBe("b");
  });

  it("rejects an illegal move with null", () => {
    const e = new ChessEngine();
    expect(e.move({ from: "e2", to: "e5" })).toBeNull();
  });

  it("detects checkmate", () => {
    const e = new ChessEngine("6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1");
    e.move({ from: "a1", to: "a8" });
    expect(e.status()).toBe("checkmate");
    expect(e.isGameOver()).toBe(true);
  });

  it("finds the king square", () => {
    const e = new ChessEngine();
    expect(e.kingSquare("w")).toBe("e1");
    expect(e.kingSquare("b")).toBe("e8");
  });

  it("lists legal targets from a square", () => {
    const e = new ChessEngine();
    expect(e.legalTargets("e2").sort()).toEqual(["e3", "e4"]);
  });
});
