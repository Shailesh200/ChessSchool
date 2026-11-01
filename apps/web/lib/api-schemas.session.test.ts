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

  it("drops a malformed lastActiveDay or homeworkLastDay as missing, no rejection", () => {
    const base = { xp: 0, streak: 0, graduatedClasses: [], lessons: {} };
    for (const bad of ["2026-02-30", "nope", "2026-13-40", ""]) {
      const parsed = progressPushSchema.safeParse({
        ...base,
        lastActiveDay: bad,
        homeworkLastDay: bad,
      });
      expect(parsed.success, bad).toBe(true);
      expect(parsed.data?.lastActiveDay, bad).toBeNull();
      expect(parsed.data?.homeworkLastDay, bad).toBeUndefined();
    }
    const good = progressPushSchema.parse({
      ...base,
      lastActiveDay: "2026-10-22",
      homeworkLastDay: "2026-10-21",
    });
    expect(good.lastActiveDay).toBe("2026-10-22");
    expect(good.homeworkLastDay).toBe("2026-10-21");
    expect(
      progressPushSchema.parse({ ...base, lastActiveDay: null, homeworkLastDay: null })
        .homeworkLastDay,
    ).toBeNull();
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

describe("progressPushSchema tolerant fields", () => {
  const base = {
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    graduatedClasses: [],
    lessons: {},
  };

  it("drops a time zone the server cannot resolve instead of rejecting the push", () => {
    for (const tz of ["GMT+5", "Etc/Unknown", "Not/AZone", "", "x".repeat(65), 5]) {
      const parsed = progressPushSchema.safeParse({ ...base, tz });
      expect(parsed.success, String(tz)).toBe(true);
      expect(parsed.data?.tz, String(tz)).toBeUndefined();
    }
    expect(progressPushSchema.parse({ ...base, tz: "America/Los_Angeles" }).tz).toBe(
      "America/Los_Angeles",
    );
    expect(progressPushSchema.parse(base).tz).toBeUndefined();
  });

  it("stores a time zone alias in its canonical form", () => {
    expect(progressPushSchema.parse({ ...base, tz: "US/Pacific" }).tz).toBe(
      "America/Los_Angeles",
    );
    expect(progressPushSchema.parse({ ...base, tz: " US/Pacific " }).tz).toBe(
      "America/Los_Angeles",
    );
    // The canonical spelling of India's zone depends on the ICU build, so the
    // contract is that both spellings store the same value.
    const calcutta = progressPushSchema.parse({ ...base, tz: "Asia/Calcutta" }).tz;
    const kolkata = progressPushSchema.parse({ ...base, tz: "Asia/Kolkata" }).tz;
    expect(calcutta).toBeDefined();
    expect(calcutta).toBe(kolkata);
  });

  it("drops activityDays keys that are not YYYY-MM-DD and keeps the rest", () => {
    const parsed = progressPushSchema.safeParse({
      ...base,
      activityDays: {
        "2026-10-28": 40,
        "2026-10-29": 10,
        today: 5,
        "2026-1-5": 1,
        "2026-10-29T00:00": 2,
        "": 3,
      },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.activityDays).toEqual({ "2026-10-28": 40, "2026-10-29": 10 });
  });

  it("drops weakness keys longer than 64 characters and keeps the rest", () => {
    const parsed = progressPushSchema.safeParse({
      ...base,
      weaknesses: { fork: 3, ["k".repeat(64)]: 2, ["k".repeat(65)]: 9 },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.data?.weaknesses).toEqual({ fork: 3, ["k".repeat(64)]: 2 });
  });
});
