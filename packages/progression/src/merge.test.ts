import { describe, expect, it } from "vitest";
import { mergeProgressSnapshots } from "./index";
import { applyProgressPushAck, clampWriterStamp, readProgressPushAck } from "./merge";

describe("writer stamps", () => {
  it("rejects a stamp below 0 and clamps one ahead of now", () => {
    const now = 10_000;
    expect(clampWriterStamp(-1, now)).toBeNull();
    expect(clampWriterStamp(1.5, now)).toBeNull();
    expect(clampWriterStamp(50_000, now)).toBe(now);
    expect(clampWriterStamp(20, now)).toBe(20);

    const merged = mergeProgressSnapshots(
      { rating: 900, ratingUpdatedAt: 50_000, dailyGoalXp: 20, goalUpdatedAt: -1 },
      { rating: 1400, ratingUpdatedAt: 100, dailyGoalXp: 80, goalUpdatedAt: 200 },
      new Date("2026-10-22T12:00:00.000Z"),
      now,
    );
    expect(merged.rating).toBe(900);
    expect(merged.ratingUpdatedAt).toBe(now);
    expect(merged.dailyGoalXp).toBe(80);
    expect(merged.goalUpdatedAt).toBe(200);
  });
});

describe("progress push ack", () => {
  it("adopts the winning fields and ignores an old ok/count body", () => {
    expect(readProgressPushAck({ ok: true, count: 1 })).toBeNull();
    const local = { rating: 1500, ratingUpdatedAt: 10, homeworkStreak: 4, xp: 3 };
    expect(applyProgressPushAck(local, { ok: true, count: 1 })).toEqual(local);
    expect(
      applyProgressPushAck(local, {
        rating: 1100,
        ratingUpdatedAt: 80,
        goalUpdatedAt: null,
        homeworkStreak: 4,
        homeworkLastDay: "2026-10-22",
      }),
    ).toMatchObject({
      rating: 1100,
      ratingUpdatedAt: 80,
      goalUpdatedAt: null,
      homeworkLastDay: "2026-10-22",
      xp: 3,
    });
  });
});
