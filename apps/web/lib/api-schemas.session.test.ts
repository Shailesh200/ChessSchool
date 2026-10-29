import { describe, expect, it } from "vitest";
import { progressPushSchema, sessionPostSchema } from "@/lib/api-schemas";

describe("sessionPostSchema", () => {
  it("accepts a valid move", () => {
    const parsed = sessionPostSchema.safeParse({
      action: "move",
      seatToken: "abc.def.ghi",
      from: "e2",
      to: "e4",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects illegal squares", () => {
    expect(
      sessionPostSchema.safeParse({
        action: "move",
        seatToken: "tok",
        from: "z9",
        to: "e4",
      }).success,
    ).toBe(false);
  });

  it("accepts resign with seat token", () => {
    expect(
      sessionPostSchema.safeParse({ action: "resign", seatToken: "tok.enough" })
        .success,
    ).toBe(true);
  });
});

describe("progressPushSchema", () => {
  it("rejects negative XP", () => {
    expect(
      progressPushSchema.safeParse({
        xp: -1,
        streak: 0,
        lastActiveDay: null,
        graduatedClasses: [],
        lessons: {},
      }).success,
    ).toBe(false);
  });

  it("clamps a future writer stamp and rejects a negative one", () => {
    const before = Date.now();
    const future = progressPushSchema.safeParse({
      xp: 0,
      streak: 0,
      lastActiveDay: null,
      graduatedClasses: [],
      lessons: {},
      ratingUpdatedAt: before + 60_000,
      goalUpdatedAt: before,
    });
    expect(future.success).toBe(true);
    if (!future.success) return;
    expect(future.data.ratingUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(future.data.ratingUpdatedAt).toBeLessThanOrEqual(Date.now());
    expect(future.data.goalUpdatedAt).toBe(before);

    expect(
      progressPushSchema.safeParse({
        xp: 0,
        streak: 0,
        lastActiveDay: null,
        graduatedClasses: [],
        lessons: {},
        ratingUpdatedAt: -1,
      }).success,
    ).toBe(false);
  });

  it("rejects a malformed lastActiveDay or homeworkLastDay", () => {
    const base = {
      xp: 0,
      streak: 0,
      graduatedClasses: [],
      lessons: {},
    };
    expect(
      progressPushSchema.safeParse({ ...base, lastActiveDay: "2026-02-30" }).success,
    ).toBe(false);
    expect(
      progressPushSchema.safeParse({ ...base, lastActiveDay: "nope" }).success,
    ).toBe(false);
    expect(
      progressPushSchema.safeParse({
        ...base,
        lastActiveDay: "2026-10-22",
        homeworkLastDay: "2026-13-40",
      }).success,
    ).toBe(false);
    expect(
      progressPushSchema.safeParse({
        ...base,
        lastActiveDay: "2026-10-22",
        homeworkLastDay: null,
        tz: "Asia/Kolkata",
      }).success,
    ).toBe(true);
  });

  it("rejects mastery above 1", () => {
    expect(
      progressPushSchema.safeParse({
        xp: 0,
        streak: 0,
        lastActiveDay: null,
        graduatedClasses: [],
        lessons: { foo: { mastery: 1.5, attempts: 0, lastSeen: 0, dueAt: 0 } },
      }).success,
    ).toBe(false);
  });
});
