import { describe, expect, it } from "vitest";
import { editPlacement, placementFromRanks, setupFen, setupProblem } from "./scan";

const START = ["rnbqkbnr", "pppppppp", "........", "........", "........", "........", "PPPPPPPP", "RNBQKBNR"];

describe("board scanner helpers", () => {
  it("turns scanned ranks into a FEN placement, rejecting anything not 8 x 8", () => {
    expect(placementFromRanks(START)).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR");
    expect(placementFromRanks(["....k...", "........", "........", "........", "........", "........", "........", "R...K..."])).toBe("4k3/8/8/8/8/8/8/R3K3");
    expect(placementFromRanks(START.slice(1))).toBeNull();
    expect(placementFromRanks([...START.slice(1), "RNBQKBN"])).toBeNull();
    expect(placementFromRanks([...START.slice(1), "RNBQKBNX"])).toBeNull();
    expect(placementFromRanks("rnbqkbnr")).toBeNull();
  });

  it("edits one square, and a second tap of the same piece clears it", () => {
    const p = "4k3/8/8/8/8/8/8/4K3";
    expect(editPlacement(p, "d4", "N")).toBe("4k3/8/8/8/3N4/8/8/4K3");
    expect(editPlacement(editPlacement(p, "d4", "N"), "d4", "N")).toBe(p);
    expect(editPlacement(editPlacement(p, "d4", "N"), "d4", "q")).toBe("4k3/8/8/8/3q4/8/8/4K3");
    expect(editPlacement(p, "e1", null)).toBe("4k3/8/8/8/8/8/8/8");
  });

  it("gives castling rights only where king and rook stand at home", () => {
    expect(setupFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR", "w")).toBe("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1");
    expect(setupFen("4k3/8/8/8/8/8/8/R3K3", "b")).toBe("4k3/8/8/8/8/8/8/R3K3 b Q - 0 1");
    expect(setupFen("4k3/8/8/8/8/8/8/4K3", "w")).toBe("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
  });

  it("says what is wrong with a position before it can be played", () => {
    expect(setupProblem("4k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBeNull();
    expect(setupProblem("8/8/8/8/8/8/8/4K3 w - - 0 1")).toBe("kings");
    expect(setupProblem("4k3/8/8/8/8/8/8/4KK2 w - - 0 1")).toBe("kings");
    expect(setupProblem("P3k3/8/8/8/8/8/8/4K3 w - - 0 1")).toBe("pawns");
    expect(setupProblem("4k3/8/8/8/8/8/8/4R1K1 w - - 0 1")).toBe("check");
    expect(setupProblem("4k3/8/8/8/8/8/8/4R1K1 b - - 0 1")).toBeNull();
  });
});
