import { describe, expect, it } from "vitest";
import { START_FEN } from "./board";
import { coachMoments, detectMistakes, forkTargets, hangingPieces, isBackRankMate, mateInOne, mateInTwo, pinnedBy } from "./coach";
import { reviewPlies } from "./review";

describe("mistake detectors", () => {
  it("finds a hanging piece", () => {
    // White knight on e5 attacked by the d6 pawn.
    expect(hangingPieces("4k3/8/3p4/4N3/8/8/8/4K3 w - - 0 1", "w")).toEqual(["e5"]);
    // Defended and only attacked by a rook: still safe.
    expect(hangingPieces("4k3/4r3/8/4N3/3P4/8/8/4K3 w - - 0 1", "w")).toEqual([]);
  });

  it("spots a knight fork of king and rook", () => {
    expect(forkTargets("r3k3/8/8/1N6/8/8/8/4K3 w - - 0 1", "Nc7+").sort()).toEqual(["a8", "e8"]);
    expect(forkTargets(START_FEN, "Nf3")).toEqual([]);
  });

  it("spots a pin against the king", () => {
    expect(pinnedBy("4k3/8/8/8/8/8/8/4KB2 w - - 0 1", "Bb5+")).toBeNull();
    expect(pinnedBy("4k3/3n4/8/8/8/8/8/4KB2 w - - 0 1", "Bb5")).toBe("d7");
  });

  it("finds mate in one and two, and back-rank mates", () => {
    const backRank = "6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1";
    expect(mateInOne(backRank)).toBe("Ra8#");
    expect(isBackRankMate(backRank, "Ra8#")).toBe(true);
    expect(mateInOne(START_FEN)).toBeNull();
    // Rb7+ drives the king back, Ra8 mates.
    expect(mateInTwo("8/7k/R7/8/8/8/8/1R4K1 w - - 0 1")).toBe("Rb7+");
  });

  it("tags a move that allowed a back-rank mate", () => {
    const [p] = reviewPlies("4r1k1/5ppp/8/8/8/8/5PPP/3Q2K1 w - - 0 1", ["Qd4"]);
    const facts = detectMistakes(p!, null);
    expect(facts.tags).toEqual(expect.arrayContaining(["mate", "backRank"]));
    expect(facts.threat).toBe("Re1#");
  });

  it("tags a missed free piece", () => {
    const [p] = reviewPlies("4k3/8/8/3q4/8/8/3R4/4K3 w - - 0 1", ["Kf1"]);
    const facts = detectMistakes(p!, "Rxd5");
    expect(facts.tags).toContain("freePiece");
    expect(facts.squares).toContain("d5");
    expect(facts.pieces).toContain("q");
  });
});

describe("coach moments", () => {
  it("picks the biggest swings with a better move and tags", () => {
    const moments = coachMoments(START_FEN, ["e4", "e5", "Qh5", "Nc6", "Qxe5+", "Nxe5"], "w");
    expect(moments.length).toBeGreaterThan(0);
    const queen = moments.find((m) => m.san === "Qxe5+")!;
    expect(queen.verdict).toBe("blunder");
    expect(queen.tags).toContain("hanging");
    expect(queen.squares).toContain("e5");
    expect(coachMoments(START_FEN, ["e4", "e5"], "w")).toEqual([]);
  });
});

describe("pgn", () => {
  it("reads a PGN with headers", async () => {
    const { parsePgn } = await import("./game");
    const g = parsePgn('[White "a"]\n[Black "b"]\n[Result "0-1"]\n\n1. f3 e5 2. g4 Qh4# 0-1');
    expect(g?.moves).toEqual(["f3", "e5", "g4", "Qh4#"]);
    expect(g?.headers.Result).toBe("0-1");
    expect(parsePgn("1. e4 Ke7 2. Zz9")).toBeNull();
  });
});
