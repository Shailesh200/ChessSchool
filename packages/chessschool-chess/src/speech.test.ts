import { describe, expect, it } from "vitest";
import { parseSpokenMove } from "./speech";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const san = (fen: string, heard: string | string[]) => {
  const r = parseSpokenMove(fen, heard);
  return r.kind === "move" ? r.move.san : r.kind === "ambiguous" ? r.options.map((o) => o.san).sort() : null;
};
// 1.e4 d5: white can take on d5; both castles open in CASTLE.
const SCANDI = "rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2";
const CASTLE = "r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1";
const KNIGHTS = "4k3/8/8/8/8/8/8/1N2KN2 w - - 0 1"; // Nb1 and Nf1 can both reach d2
const PROMO = "8/P7/8/8/8/8/7k/4K3 w - - 0 1";

describe("spoken moves (English)", () => {
  it("reads piece + square in the usual phrasings", () => {
    expect(san(START, "knight to f3")).toBe("Nf3");
    expect(san(START, "Knight F3")).toBe("Nf3");
    expect(san(START, "night f 3")).toBe("Nf3");
    expect(san(START, "Nf3")).toBe("Nf3");
  });
  it("treats a bare square as a pawn move, and from/to pairs", () => {
    expect(san(START, "e4")).toBe("e4");
    expect(san(START, "e two e four")).toBe("e4");
    expect(san(START, "see four")).toBe("c4");
  });
  it("reads captures, with or without a square", () => {
    expect(san(SCANDI, "pawn takes d5")).toBe("exd5");
    expect(san(SCANDI, "e takes d5")).toBe("exd5");
    expect(san(SCANDI, "takes")).toBeNull();
    expect(san(SCANDI, "pawn takes")).toBe("exd5");
    expect(san("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "queen takes")).toBe("Qxd5");
    expect(san("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "queen takes pawn")).toBe("Qxd5");
  });
  it("castles, asking which side when both are legal", () => {
    expect(san(CASTLE, "castle kingside")).toBe("O-O");
    expect(san(CASTLE, "castle queen side")).toBe("O-O-O");
    expect(san(CASTLE, "castles long")).toBe("O-O-O");
    expect(san(CASTLE, "castle")).toEqual(["O-O", "O-O-O"]);
  });
  it("ignores 'check' and asks which piece when two can go", () => {
    expect(san("4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "bishop a3 check")).toBe("Ba3");
    expect(san(KNIGHTS, "knight d2")).toEqual(["Nbd2", "Nfd2"]);
    expect(san(KNIGHTS, "knight b1 d2")).toBe("Nbd2");
  });
  it("asks for the promotion piece unless it was said", () => {
    expect(san(PROMO, "a8 queen")).toBe("a8=Q");
    expect(san(PROMO, "a8")).toEqual(["a8=B", "a8=N", "a8=Q", "a8=R"]);
  });
  it("returns none for anything not legal or not a move", () => {
    expect(san(START, "knight to e5")).toBeNull();
    expect(san(START, "hello there")).toBeNull();
    expect(san(START, "")).toBeNull();
  });
  it("tries each recogniser guess in turn", () => {
    expect(san(START, ["night to have three", "knight to f3"])).toBe("Nf3");
    expect(san(KNIGHTS, ["blah", "knight d2", "knight b1 d2"])).toBe("Nbd2");
    expect(san(KNIGHTS, ["blah", "knight d2"])).toEqual(["Nbd2", "Nfd2"]);
  });
});

describe("spoken moves (Hindi)", () => {
  it("reads Hindi piece names with Hindi or English squares", () => {
    expect(san(START, "घोड़ा एफ़ तीन")).toBe("Nf3");
    expect(san(START, "घोडा एफ 3")).toBe("Nf3");
    expect(san(START, "घोड़ा f3")).toBe("Nf3");
    expect(san(START, "प्यादा ई चार")).toBe("e4");
    expect(san(START, "ई दो से ई चार")).toBe("e4");
    expect(san("4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "ऊँट ए तीन")).toBe("Ba3");
    expect(san("4k3/8/8/8/8/8/8/2B1K3 w - - 0 1", "ऊंट ए३")).toBe("Ba3");
  });
  it("reads Hindi captures and castling", () => {
    expect(san(SCANDI, "प्यादा मारे डी पाँच")).toBe("exd5");
    expect(san("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "वज़ीर डी पांच")).toBe("Qxd5");
    expect(san("4k3/8/8/3p4/8/8/8/3QK3 w - - 0 1", "रानी मारे")).toBe("Qxd5");
    expect(san(CASTLE, "छोटी कैसलिंग")).toBe("O-O");
    expect(san(CASTLE, "हाथी ए दो")).toBe("Ra2");
    expect(san(CASTLE, "राजा एफ एक")).toBe("Kf1");
  });
});
