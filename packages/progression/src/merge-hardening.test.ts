import { describe, expect, it } from "vitest";
import {
  mergeProgressSnapshots,
  normalizeProgressPush,
  MAX_ACTIVITY_DAYS,
  MAX_WEAKNESSES,
} from "./index";
import {
  allowedDailyGoal,
  clampRating,
  isRecordedMistake,
  mergeMistakeLog,
} from "./merge";

const NOW = new Date("2026-10-22T12:00:00.000Z");
const NOW_MS = 1_000_000;

describe("a writer stamp without its value is ignored", () => {
  it("a local stamp with no rating never resets a stored rating to 800", () => {
    const merged = mergeProgressSnapshots(
      { ratingUpdatedAt: 9_000, goalUpdatedAt: 9_000 },
      { rating: 1200, ratingUpdatedAt: 100, dailyGoalXp: 30, goalUpdatedAt: 100 },
      NOW,
      NOW_MS,
    );
    expect(merged.rating).toBe(1200);
    expect(merged.ratingUpdatedAt).toBe(100);
    expect(merged.dailyGoalXp).toBe(30);
    expect(merged.goalUpdatedAt).toBe(100);
  });

  it("the same holds when the stored side lost its value", () => {
    const merged = mergeProgressSnapshots(
      { rating: 1100, ratingUpdatedAt: 50, dailyGoalXp: 40, goalUpdatedAt: 50 },
      { ratingUpdatedAt: 9_000, goalUpdatedAt: 9_000 },
      NOW,
      NOW_MS,
    );
    expect(merged.rating).toBe(1100);
    expect(merged.dailyGoalXp).toBe(40);
  });

  it("normalizeProgressPush drops a stamp whose value was not sent", () => {
    const out = normalizeProgressPush({ ratingUpdatedAt: 9_000, goalUpdatedAt: 9_000 });
    expect(out.ratingUpdatedAt).toBeUndefined();
    expect(out.goalUpdatedAt).toBeUndefined();
    const kept = normalizeProgressPush({
      rating: 900,
      ratingUpdatedAt: 5,
      dailyGoalXp: 30,
      goalUpdatedAt: 6,
    });
    expect(kept.ratingUpdatedAt).toBe(5);
    expect(kept.goalUpdatedAt).toBe(6);
  });
});

describe("rating clamp and allowed daily goal", () => {
  it("clamps the rating to 100..3000", () => {
    expect(clampRating(99_999)).toBe(3000);
    expect(clampRating(-50)).toBe(100);
    expect(clampRating(1234.6)).toBe(1235);
    expect(clampRating(Number.NaN)).toBeUndefined();
    const merged = mergeProgressSnapshots(
      { rating: 99_999, ratingUpdatedAt: 20 },
      { rating: 1000, ratingUpdatedAt: 10 },
      NOW,
      NOW_MS,
    );
    expect(merged.rating).toBe(3000);
    expect(
      mergeProgressSnapshots({ rating: -5, ratingUpdatedAt: 20 }, {}, NOW, NOW_MS)
        .rating,
    ).toBe(100);
  });

  it("snaps a daily goal outside the allowed set to the nearest allowed value", () => {
    expect(allowedDailyGoal(10)).toBe(10);
    expect(allowedDailyGoal(200)).toBe(200);
    expect(allowedDailyGoal(47)).toBe(50);
    expect(allowedDailyGoal(44)).toBe(40);
    expect(allowedDailyGoal(33.5)).toBe(30);
    for (const [legacy, snapped] of [
      [0, 10],
      [5, 10],
      [-10, 10],
      [205, 200],
      [210, 200],
      [1e9, 200],
    ] as const) {
      expect(allowedDailyGoal(legacy), String(legacy)).toBe(snapped);
    }
    for (const missing of [Number.NaN, Infinity, "50", null, undefined]) {
      expect(allowedDailyGoal(missing)).toBeUndefined();
    }
    const merged = mergeProgressSnapshots(
      { dailyGoalXp: 999_999, goalUpdatedAt: 20 },
      { dailyGoalXp: 40, goalUpdatedAt: 10 },
      NOW,
      NOW_MS,
    );
    expect(merged.dailyGoalXp).toBe(200);
    const legacyServer = mergeProgressSnapshots(
      {},
      { dailyGoalXp: 45, goalUpdatedAt: 10 },
      NOW,
      NOW_MS,
    );
    expect(legacyServer.dailyGoalXp).toBe(50);
  });
});

describe("lastActiveDay never moves earlier", () => {
  it("an older local day does not beat a newer stored day", () => {
    const merged = mergeProgressSnapshots(
      { lastActiveDay: "2026-10-10" },
      { lastActiveDay: "2026-10-21" },
      NOW,
      NOW_MS,
    );
    expect(merged.lastActiveDay).toBe("2026-10-21");
  });

  it("a newer local day wins, and a far-future day is dropped", () => {
    expect(
      mergeProgressSnapshots(
        { lastActiveDay: "2026-10-22" },
        { lastActiveDay: "2026-10-01" },
        NOW,
        NOW_MS,
      ).lastActiveDay,
    ).toBe("2026-10-22");
    expect(
      mergeProgressSnapshots(
        { lastActiveDay: "2030-01-01" },
        { lastActiveDay: "2026-10-01" },
        NOW,
        NOW_MS,
      ).lastActiveDay,
    ).toBe("2026-10-01");
  });
});

describe("key caps are applied after the union", () => {
  const days = (from: number, count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        `d${String(from + i).padStart(6, "0")}`,
        1,
      ]),
    );

  it("a large stored activityDays map plus a push is trimmed to the newest 2000", () => {
    const merged = mergeProgressSnapshots(
      { activityDays: days(1900, 200) },
      { activityDays: days(0, 2000) },
      NOW,
      NOW_MS,
    );
    const keys = Object.keys(merged.activityDays ?? {}).sort();
    expect(keys).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(keys[keys.length - 1]).toBe("d002099");
    expect(keys[0]).toBe("d000100");
  });

  it("weaknesses keep the 200 highest counts after the union", () => {
    const weak = (prefix: string, n: number, count: number) =>
      Object.fromEntries(
        Array.from({ length: n }, (_, i) => [
          `${prefix}${String(i).padStart(4, "0")}`,
          count,
        ]),
      );
    const merged = mergeProgressSnapshots(
      { weaknesses: { ...weak("a", 150, 1), hot: 99 } },
      { weaknesses: weak("b", 200, 2) },
      NOW,
      NOW_MS,
    );
    const w = merged.weaknesses ?? {};
    expect(Object.keys(w)).toHaveLength(MAX_WEAKNESSES);
    expect(w.hot).toBe(99);
    expect(Object.keys(w).some((k) => k.startsWith("a"))).toBe(false);
  });

  it("normalizeProgressPush trims before sending", () => {
    const out = normalizeProgressPush({
      activityDays: days(0, 2600),
      weaknesses: Object.fromEntries(
        Array.from({ length: 300 }, (_, i) => [`w${i}`, i]),
      ),
    });
    expect(Object.keys(out.activityDays ?? {})).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(Object.keys(out.weaknesses ?? {})).toHaveLength(MAX_WEAKNESSES);
    expect(out.weaknesses?.w299).toBe(299);
  });
});

describe("mistake log", () => {
  it("compares `at` as a number on an id collision", () => {
    const merged = mergeMistakeLog(
      [{ id: "m1", fen: "f", at: 1000 }],
      [{ id: "m1", fen: "f", at: 999 }],
    );
    expect(merged).toEqual([{ id: "m1", fen: "f", at: 1000 }]);
    const flipped = mergeMistakeLog(
      [{ id: "m1", fen: "f", at: 999 }],
      [{ id: "m1", fen: "f", at: 1000 }],
    );
    expect(flipped).toEqual([{ id: "m1", fen: "f", at: 1000 }]);
  });

  it("sorts an entry whose `at` is not a number as time 0, newest first", () => {
    const text = { id: "a", fen: "f", at: "zzz" as unknown as number };
    const newest = { id: "b", fen: "f", at: 5 };
    const older = { id: "c", fen: "f", at: 3 };
    const merged = mergeMistakeLog([text, older], [newest]);
    expect(merged.map((m) => m.id)).toEqual(["b", "c", "a"]);
  });

  it("drops entries without a string fen, and arrays", () => {
    const kept = { fen: "ok", at: 3 };
    expect(isRecordedMistake([])).toBe(false);
    expect(isRecordedMistake({})).toBe(false);
    expect(isRecordedMistake({ fen: 4 })).toBe(false);
    expect(isRecordedMistake(kept)).toBe(true);
    const merged = mergeMistakeLog(
      [kept, {}, { at: 9 }, [], [{ fen: "nested" }], { fen: 1 }],
      [{ played: "e4", at: 7 }],
    );
    expect(merged).toEqual([kept]);
  });
});
