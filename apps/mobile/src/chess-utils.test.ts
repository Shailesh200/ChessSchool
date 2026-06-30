import { describe, it, expect } from "vitest";
import { material, advantage, clock, fenToBoard, turnOf, placement, onlineOutcome } from "./chess-utils";

const START = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

describe("material", () => {
  it("counts the starting position as even (39 each)", () => {
    expect(material(START)).toEqual({ w: 39, b: 39 });
  });
  it("counts a lone king as 0", () => {
    expect(material("8/8/8/8/8/8/8/K7 w - - 0 1")).toEqual({ w: 0, b: 0 });
  });
  it("counts an extra white queen", () => {
    expect(material("8/8/8/8/8/8/8/KQ5k w - - 0 1")).toEqual({ w: 9, b: 0 });
  });
});

describe("advantage", () => {
  it("is 0 when even", () => {
    expect(advantage(START, "w")).toBe(0);
    expect(advantage(START, "b")).toBe(0);
  });
  it("gives white +9 for an extra queen, black 0 (never negative)", () => {
    const fen = "7k/8/8/8/8/8/8/KQ6 w - - 0 1";
    expect(advantage(fen, "w")).toBe(9);
    expect(advantage(fen, "b")).toBe(0);
  });
});

describe("clock", () => {
  it("formats minutes and seconds", () => {
    expect(clock(600000)).toBe("10:00");
    expect(clock(65000)).toBe("1:05");
    expect(clock(9000)).toBe("0:09");
  });
  it("clamps negatives to 0:00", () => {
    expect(clock(-500)).toBe("0:00");
  });
});

describe("fenToBoard", () => {
  it("parses 8 ranks of 8", () => {
    const b = fenToBoard(START);
    expect(b).toHaveLength(8);
    expect(b.every((r) => r.length === 8)).toBe(true);
  });
  it("rank 8 is black back rank, rank 1 white", () => {
    const b = fenToBoard(START);
    expect(b[0]![0]).toEqual({ type: "r", color: "b" });
    expect(b[7]![4]).toEqual({ type: "k", color: "w" });
    expect(b[3]![3]).toBeNull();
  });
});

describe("turnOf", () => {
  it("reads the side to move", () => {
    expect(turnOf(START)).toBe("w");
    expect(turnOf("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR b KQkq - 0 1")).toBe("b");
  });
});

describe("placement", () => {
  it("places by score band with the right skips", () => {
    expect(placement(0.9)).toEqual({ elo: 1400, label: "High School", skip: ["elementary", "middle"] });
    expect(placement(0.6)).toEqual({ elo: 1000, label: "Middle School", skip: ["elementary"] });
    expect(placement(0.4)).toMatchObject({ elo: 700, skip: [] });
    expect(placement(0)).toMatchObject({ elo: 500, skip: [] });
  });
  it("boundaries land in the higher band", () => {
    expect(placement(0.85).elo).toBe(1400);
    expect(placement(0.55).elo).toBe(1000);
    expect(placement(0.3).elo).toBe(700);
  });
});

describe("onlineOutcome", () => {
  it("is pending with no result", () => {
    expect(onlineOutcome(null, "w")).toBe("pending");
  });
  it("maps checkmate results per color", () => {
    expect(onlineOutcome("1-0", "w")).toBe("win");
    expect(onlineOutcome("1-0", "b")).toBe("loss");
    expect(onlineOutcome("0-1", "b")).toBe("win");
  });
  it("maps resign + timeout (result names the winner)", () => {
    expect(onlineOutcome("resign:b", "w")).toBe("win"); // black resigned → white wins
    expect(onlineOutcome("resign:w", "w")).toBe("loss"); // white resigned → white loses
    expect(onlineOutcome("time:w", "w")).toBe("win"); // white wins on time
    expect(onlineOutcome("time:b", "b")).toBe("win"); // black wins on time
    expect(onlineOutcome("time:w", "b")).toBe("loss"); // white wins on time → black loses
  });
  it("maps draws", () => {
    expect(onlineOutcome("1/2-1/2", "w")).toBe("draw");
    expect(onlineOutcome("1/2-1/2", "b")).toBe("draw");
  });
});
