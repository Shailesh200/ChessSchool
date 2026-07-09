import { describe, it, expect } from "vitest";
import { isParticipant, seatColorForUser } from "./game-session-seat";
import type { DBGameSession } from "@/db/schema";

const base: DBGameSession = {
  id: "g1",
  fen: "start",
  pgn: "",
  lastFrom: null,
  lastTo: null,
  turn: "w",
  status: "waiting",
  result: null,
  blackJoined: 0,
  whiteUserId: "user-a",
  blackUserId: null,
  timeControlMin: 10,
  whiteMs: 600000,
  blackMs: 600000,
  createdAt: 0,
  updatedAt: 0,
};

describe("seatColorForUser", () => {
  it("returns w for white owner", () => {
    expect(seatColorForUser(base, "user-a")).toBe("w");
  });

  it("returns b for black owner", () => {
    expect(
      seatColorForUser({ ...base, blackUserId: "user-b", blackJoined: 1 }, "user-b"),
    ).toBe("b");
  });

  it("returns null for strangers", () => {
    expect(seatColorForUser(base, "user-c")).toBeNull();
  });
});

describe("isParticipant", () => {
  it("returns true only for seated players", () => {
    expect(isParticipant(base, "user-a")).toBe(true);
    expect(
      isParticipant({ ...base, blackUserId: "user-b", blackJoined: 1 }, "user-b"),
    ).toBe(true);
    expect(isParticipant(base, "user-c")).toBe(false);
  });
});
