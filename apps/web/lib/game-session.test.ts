import { describe, it, expect } from "vitest";
import { formatSeatToken } from "./session-secret";
import {
  isParticipant,
  seatColorForUser,
  seatTokenMatchesSession,
} from "./game-session-seat";
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

describe("seatTokenMatchesSession", () => {
  it("accepts the seat token for white or black and rejects the rest", () => {
    const white = formatSeatToken(base.id, "w", "user-a");
    expect(seatTokenMatchesSession(base, white)).toBe(true);

    const seated = { ...base, blackUserId: "user-b", blackJoined: 1 as const };
    const black = formatSeatToken(seated.id, "b", "user-b");
    expect(seatTokenMatchesSession(seated, black)).toBe(true);
    expect(seatTokenMatchesSession(seated, white)).toBe(true);

    const onlyBlack = { ...base, whiteUserId: null, blackUserId: "user-b" };
    expect(seatTokenMatchesSession(onlyBlack, black)).toBe(true);
    expect(seatTokenMatchesSession(onlyBlack, white)).toBe(false);

    expect(
      seatTokenMatchesSession(seated, formatSeatToken("other", "w", "user-a")),
    ).toBe(false);
    expect(
      seatTokenMatchesSession(seated, formatSeatToken(seated.id, "w", "user-b")),
    ).toBe(false);
    expect(seatTokenMatchesSession(base, "w.forged")).toBe(false);
  });
});
