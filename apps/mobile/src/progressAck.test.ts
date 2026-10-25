import { describe, expect, it } from "vitest";
import { applyProgressPushAck } from "@chess-school/progression";

describe("mobile progress POST ack", () => {
  it("adopts the merged snapshot and ignores a legacy body", () => {
    const local = {
      streak: 1,
      lastActiveDay: "2026-10-20",
      rating: 1500,
      dailyGoalXp: 80,
      homeworkStreak: 4,
      xp: 12,
    };
    expect(applyProgressPushAck(local, { ok: true, count: 1 })).toEqual(local);
    expect(
      applyProgressPushAck(local, {
        ok: true,
        count: 1,
        streak: 5,
        lastActiveDay: "2026-10-22",
        rating: 1410,
        dailyGoalXp: 30,
        homeworkStreak: 1,
      }),
    ).toMatchObject({
      streak: 5,
      lastActiveDay: "2026-10-22",
      rating: 1410,
      dailyGoalXp: 30,
      homeworkStreak: 1,
      xp: 12,
    });
  });
});
