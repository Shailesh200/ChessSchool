import { describe, expect, it } from "vitest";
import { applyProgressPushAck } from "@chess-school/progression";

describe("mobile progress POST ack", () => {
  it("adopts the merged snapshot and ignores a legacy body", () => {
    const local = { streak: 1, rating: 1500, homeworkStreak: 4, xp: 12 };
    expect(applyProgressPushAck(local, { ok: true, count: 1 })).toEqual(local);
    expect(
      applyProgressPushAck(local, {
        streak: 3,
        rating: 1410,
        ratingUpdatedAt: 5_000,
        homeworkLastDay: "2026-10-22",
      }).streak,
    ).toBe(3);
  });
});
