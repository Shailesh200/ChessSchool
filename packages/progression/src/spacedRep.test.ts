/**
 * Characterization of today's spaced repetition.
 * Intervals come from recordLesson mastery bands (1 / 2 / 5 / 14 days).
 * There is no ease factor and no separate review streak: mastery is a 50/50
 * blend, and `incorrect` keeps the minimum seen so far.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { recordLesson, type Snap } from "./index";
import { dailyPuzzleId, dueLessonIds, isDailyPuzzleDone } from "./spacedRep";

const NOW = Date.parse("2026-06-15T15:00:00.000Z");
const DAY = 86_400_000;

function rec(s: Snap, id = "l1") {
  const lesson = s.lessons?.[id];
  if (!lesson) throw new Error(`missing lesson ${id}`);
  return lesson;
}

function intervalDays(s: Snap, id = "l1"): number {
  const lesson = rec(s, id);
  return (lesson.dueAt - lesson.lastSeen) / DAY;
}

describe("recordLesson scheduling intervals", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("schedules 14, 5, 2, or 1 day from the mastery band", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    expect(intervalDays(recordLesson({}, "l1", 4, 4))).toBe(14);
    expect(intervalDays(recordLesson({}, "l1", 9, 10))).toBe(5);
    expect(intervalDays(recordLesson({}, "l1", 7, 10))).toBe(2);
    expect(intervalDays(recordLesson({}, "l1", 2, 5))).toBe(1);
    expect(rec(recordLesson({}, "l1", 4, 4)).lastSeen).toBe(NOW);
    expect(rec(recordLesson({}, "l1", 4, 4)).dueAt).toBe(NOW + 14 * DAY);
  });

  it("uses the 1-day band when the score is zero or the total is zero", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    expect(intervalDays(recordLesson({}, "l1", 0, 4))).toBe(1);
    expect(rec(recordLesson({}, "l1", 0, 4)).mastery).toBe(0);
    expect(intervalDays(recordLesson({}, "l1", 0, 0))).toBe(1);
  });

  it("has no ease factor: correct and incorrect answers only blend mastery", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(NOW);

    let s = recordLesson({}, "l1", 0, 4, 4);
    expect(rec(s).mastery).toBe(0);
    expect(intervalDays(s)).toBe(1);
    expect(rec(s).attempts).toBe(1);
    expect(rec(s).incorrect).toBe(4);

    s = recordLesson(s, "l1", 4, 4, 1);
    expect(rec(s).mastery).toBe(0.5);
    expect(intervalDays(s)).toBe(2);
    expect(rec(s).attempts).toBe(2);
    // A better incorrect count replaces the stored one; a worse one cannot raise it.
    expect(rec(s).incorrect).toBe(1);

    s = recordLesson(s, "l1", 4, 4, 5);
    expect(rec(s).mastery).toBe(0.75);
    expect(intervalDays(s)).toBe(5);
    expect(rec(s).incorrect).toBe(1);
    expect(rec(s).attempts).toBe(3);
  });
});

describe("dueLessonIds", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const now = 1_000_000;
  const lesson = (mastery: number, dueAt: number) => ({
    mastery,
    attempts: 1,
    lastSeen: 0,
    dueAt,
  });

  it("returns due lessons that are started but not yet solid, soonest first", () => {
    const lessons = {
      later: lesson(0.5, now + 1),
      soon: lesson(0.8, now - 10),
      solid: lesson(0.9, now - 10),
      unseen: lesson(0, now - 10),
      mid: lesson(0.2, now),
    };

    expect(dueLessonIds(lessons, now)).toEqual(["soon", "mid"]);
  });

  it("treats a due time equal to now as due and excludes empty input", () => {
    expect(dueLessonIds({}, now)).toEqual([]);
    expect(dueLessonIds({ only: lesson(0.5, now) }, now)).toEqual(["only"]);
    expect(dueLessonIds({ only: lesson(0.5, now + 1) }, now)).toEqual([]);
  });

  it("keeps insertion order when two lessons share a due time", () => {
    expect(
      dueLessonIds(
        {
          first: lesson(0.5, now),
          second: lesson(0.6, now),
        },
        now,
      ),
    ).toEqual(["first", "second"]);
  });

  it("does not select a mastered lesson or a zero-mastery miss even after the due time", () => {
    expect(
      dueLessonIds(
        {
          mastered: lesson(1, now - 1),
          missed: lesson(0, now - 1),
          justUnder: lesson(0.899, now - 1),
        },
        now,
      ),
    ).toEqual(["justUnder"]);
  });

  it("uses the clock when now is omitted", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(now);
    expect(dueLessonIds({ due: lesson(0.5, now) })).toEqual(["due"]);
    expect(dueLessonIds({ waiting: lesson(0.5, now + 1) })).toEqual([]);
  });
});

describe("dailyPuzzleId", () => {
  const pool = ["a", "b", "c", "d", "e"];

  it("is deterministic for a day and empty for an empty pool", () => {
    expect(dailyPuzzleId(pool, "2026-06-15")).toBe("a");
    expect(dailyPuzzleId(pool, "2026-06-15")).toBe(dailyPuzzleId(pool, "2026-06-15"));
    expect(dailyPuzzleId(pool, "2026-06-16")).toBe("b");
    expect(dailyPuzzleId([], "2026-06-15")).toBeNull();
    expect(dailyPuzzleId(["only"], "")).toBe("only");
    const holey = ["a", "b", "c", "d", "e"];
    delete holey[0];
    expect(dailyPuzzleId(holey, "2026-06-15")).toBeNull();
  });
});

describe("isDailyPuzzleDone", () => {
  it("is true only when the completed day is exactly today", () => {
    expect(isDailyPuzzleDone("2026-06-15", "2026-06-15")).toBe(true);
    expect(isDailyPuzzleDone("2026-06-15", "2026-06-14")).toBe(false);
    expect(isDailyPuzzleDone("2026-06-15", null)).toBe(false);
    expect(isDailyPuzzleDone("2026-06-15", undefined)).toBe(false);
    expect(isDailyPuzzleDone("2026-06-15")).toBe(false);
  });
});
