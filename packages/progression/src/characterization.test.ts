/**
 * Characterization tests for today's progression reducers.
 * Cases named "later PR will change this" lock behaviour that timezone-aware
 * days and the recency-based merge are expected to replace on purpose.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  applyLessonComplete,
  applyMatchEnd,
  awardXp,
  isoDay,
  mergeProgressSnapshots,
  normalizeProgressPush,
  recordLesson,
  registerActivity,
  updateRating,
  type Mistake,
  type Snap,
} from "./index";

const FROZEN = new Date("2026-06-15T15:00:00.000Z");
const FROZEN_DAY = "2026-06-15";

function mistake(fen: string, at: number, played = "e2e4"): Mistake {
  return { fen, played, best: "d2d4", tag: "fork", at };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FROZEN);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("isoDay", () => {
  it("current behaviour (later PR will change this): isoDay is the UTC calendar date", () => {
    expect(isoDay(new Date("2026-01-15T23:30:00.000Z"))).toBe("2026-01-15");
    // 23:30 in US Eastern is already the next UTC day.
    expect(isoDay(new Date("2026-01-15T23:30:00.000-05:00"))).toBe("2026-01-16");
    // 00:30 in India is still the previous UTC day.
    expect(isoDay(new Date("2026-01-15T00:30:00.000+05:30"))).toBe("2026-01-14");
  });

  it("reads the clock when no date is passed", () => {
    expect(isoDay()).toBe(FROZEN_DAY);
  });
});

describe("awardXp", () => {
  it("adds the amount to total xp and the current UTC day bucket", () => {
    const s = awardXp({ xp: 10, activityDays: { "2026-06-14": 5 } }, 20);
    expect(s.xp).toBe(30);
    expect(s.activityDays).toEqual({ "2026-06-14": 5, [FROZEN_DAY]: 20 });
  });

  it("accumulates further awards into the same UTC day bucket", () => {
    const s = awardXp(awardXp({ xp: 0 }, 15), 5);
    expect(s.xp).toBe(20);
    expect(s.activityDays?.[FROZEN_DAY]).toBe(20);
  });
});

describe("registerActivity", () => {
  it("same day returns the same snapshot", () => {
    const base: Snap = { streak: 4, lastActiveDay: "2026-06-15", xp: 10 };
    expect(registerActivity(base, "2026-06-15")).toBe(base);
  });

  it("consecutive day increments the streak", () => {
    const next = registerActivity(
      { streak: 4, lastActiveDay: "2026-06-14" },
      "2026-06-15",
    );
    expect(next.streak).toBe(5);
    expect(next.lastActiveDay).toBe("2026-06-15");

    const acrossMonth = registerActivity(
      { streak: 2, lastActiveDay: "2026-02-28" },
      "2026-03-01",
    );
    expect(acrossMonth.streak).toBe(3);
    expect(acrossMonth.lastActiveDay).toBe("2026-03-01");
  });

  it("a gap resets the streak to 1", () => {
    const missed = registerActivity(
      { streak: 9, lastActiveDay: "2026-06-13" },
      "2026-06-15",
    );
    expect(missed.streak).toBe(1);
    expect(missed.lastActiveDay).toBe("2026-06-15");

    const first = registerActivity({}, "2026-06-15");
    expect(first.streak).toBe(1);
    expect(first.lastActiveDay).toBe("2026-06-15");
  });
});

describe("recordLesson mastery EMA", () => {
  it("blends a mixed-score sequence 50/50 and finishes below 1", () => {
    let s = recordLesson({}, "l1", 3, 4);
    expect(s.lessons?.l1?.mastery).toBe(0.75);

    s = recordLesson(s, "l1", 1, 4);
    expect(s.lessons?.l1?.mastery).toBe(0.5);

    s = recordLesson(s, "l1", 4, 4);
    expect(s.lessons?.l1?.mastery).toBe(0.75);

    s = recordLesson(s, "l1", 2, 4);
    expect(s.lessons?.l1?.mastery).toBe(0.625);
    expect(s.lessons?.l1?.mastery).toBeLessThan(1);
    expect(s.lessons?.l1?.attempts).toBe(4);
  });

  it("stores a perfect first score as mastery 1", () => {
    const s = recordLesson({}, "l1", 4, 4);
    expect(s.lessons?.l1?.mastery).toBe(1);
    expect(s.lessons?.l1?.attempts).toBe(1);
  });
});

describe("updateRating", () => {
  it("applies Elo K=32 and counts only a win", () => {
    const win = updateRating({ rating: 800 }, 800, 1);
    expect(win.rating).toBe(816);
    expect(win.botWins).toBe(1);

    const loss = updateRating({ rating: 800, botWins: 2 }, 800, 0);
    expect(loss.rating).toBe(784);
    expect(loss.botWins).toBe(2);

    const draw = updateRating({ rating: 800, botWins: 2 }, 800, 0.5);
    expect(draw.rating).toBe(800);
    expect(draw.botWins).toBe(2);

    // 800 vs 1200, score 1: expected = 1/11, round(800 + 32 * 10/11) = 829.
    expect(updateRating({ rating: 800 }, 1200, 1).rating).toBe(829);
  });

  it("never drops below 100", () => {
    expect(updateRating({ rating: 110 }, 110, 0).rating).toBe(100);
    expect(updateRating({ rating: 100 }, 3000, 0).rating).toBe(100);
  });

  it("treats a missing rating as 800", () => {
    expect(updateRating({}, 800, 1).rating).toBe(816);
  });
});

describe("applyLessonComplete", () => {
  it("records mastery, xp, the UTC day, and a perfect-lesson achievement", () => {
    const s = applyLessonComplete(
      {},
      { lessonId: "board-basics", correct: 4, total: 4, mistakes: 0, xp: 20 },
    );
    expect(s.xp).toBe(20);
    expect(s.streak).toBe(1);
    expect(s.lastActiveDay).toBe(FROZEN_DAY);
    expect(s.lessons?.["board-basics"]?.mastery).toBe(1);
    expect(s.activityDays?.[FROZEN_DAY]).toBe(20);
    expect(s.unlockedAchievements).toEqual(["first-step", "perfect"]);
  });

  it("continues yesterday's streak and unlocks the 3-day achievement", () => {
    const s = applyLessonComplete(
      { streak: 2, lastActiveDay: "2026-06-14" },
      { lessonId: "board-basics", correct: 1, total: 1, mistakes: 0, xp: 10 },
    );
    expect(s.streak).toBe(3);
    expect(s.lastActiveDay).toBe(FROZEN_DAY);
    expect(s.unlockedAchievements).toEqual(["first-step", "perfect", "streak-3"]);
  });

  it("logs mistakes and weaknesses without the perfect achievement", () => {
    const s = applyLessonComplete(
      {},
      {
        lessonId: "fork-master",
        correct: 3,
        total: 4,
        mistakes: 1,
        xp: 25,
        logs: [mistake("8/8/8/8/8/8/8/8 w - - 0 1", 1, "e2e4")],
      },
    );
    expect(s.lessons?.["fork-master"]?.mastery).toBe(0.75);
    expect(s.xp).toBe(25);
    expect(s.streak).toBe(1);
    expect(s.mistakeLog).toEqual([mistake("8/8/8/8/8/8/8/8 w - - 0 1", 1, "e2e4")]);
    expect(s.weaknesses).toEqual({ fork: 1 });
    expect(s.unlockedAchievements).toEqual(["first-step", "tactician"]);
  });
});

describe("applyMatchEnd", () => {
  it("a win raises rating, grants 40 xp, and registers the UTC day", () => {
    const s = applyMatchEnd({ rating: 800 }, { botElo: 800, result: "win" });
    expect(s.rating).toBe(816);
    expect(s.xp).toBe(40);
    expect(s.botWins).toBe(1);
    expect(s.streak).toBe(1);
    expect(s.lastActiveDay).toBe(FROZEN_DAY);
    expect(s.activityDays?.[FROZEN_DAY]).toBe(40);
    expect(s.unlockedAchievements).toEqual(["first-win"]);
  });

  it("a loss changes rating without granting xp", () => {
    const s = applyMatchEnd({ rating: 800, xp: 15 }, { botElo: 800, result: "loss" });
    expect(s.rating).toBe(784);
    expect(s.xp).toBe(15);
    expect(s.botWins).toBe(0);
    expect(s.streak).toBe(1);
    expect(s.lastActiveDay).toBe(FROZEN_DAY);
    expect(s.unlockedAchievements).toBeUndefined();
  });

  it("a draw leaves rating and xp unchanged and still registers activity", () => {
    const s = applyMatchEnd({ rating: 800, xp: 15 }, { botElo: 800, result: "draw" });
    expect(s.rating).toBe(800);
    expect(s.xp).toBe(15);
    expect(s.botWins).toBe(0);
    expect(s.streak).toBe(1);
  });
});

describe("normalizeProgressPush", () => {
  it("fills the /api/progress defaults for an empty snapshot", () => {
    expect(normalizeProgressPush({})).toEqual({
      xp: 0,
      streak: 0,
      lastActiveDay: null,
      graduatedClasses: [],
      lessons: {},
      rating: 800,
      botWins: 0,
      dailyGoalXp: 50,
      unlockedAchievements: [],
      schoolExamsPassed: [],
      weaknesses: {},
      activityDays: {},
      mistakeLog: [],
      homeworkStreak: 0,
      homeworkLastDay: null,
      recentGames: [],
      dailyPuzzleDay: null,
      homeworkDone: {},
      placementDone: false,
      journalEntries: [],
      settings: undefined,
    });
  });

  it("floors counters, clamps xp at 0, and keeps a daily goal of at least 1", () => {
    const body = normalizeProgressPush({
      xp: 10.9,
      streak: -2.2,
      lastActiveDay: 4 as unknown as string,
      rating: 1510.2,
      botWins: 3.8,
      dailyGoalXp: 0,
      placementDone: 1 as unknown as boolean,
      graduatedClasses: "nope" as unknown as string[],
      mistakeLog: { fen: "x" } as unknown as Mistake[],
      homeworkLastDay: "2026-06-01",
      dailyPuzzleDay: "2026-06-02",
      settings: { sound: false },
      lessons: {
        l1: { mastery: 0.5, attempts: 2, lastSeen: 1, dueAt: 2 },
      },
    });

    expect(body.xp).toBe(10);
    expect(body.streak).toBe(0);
    expect(body.lastActiveDay).toBeNull();
    expect(body.rating).toBe(1510.2);
    expect(body.botWins).toBe(3);
    expect(body.dailyGoalXp).toBe(1);
    expect(body.placementDone).toBe(true);
    expect(body.graduatedClasses).toEqual([]);
    expect(body.mistakeLog).toEqual([]);
    expect(body.homeworkLastDay).toBe("2026-06-01");
    expect(body.dailyPuzzleDay).toBe("2026-06-02");
    expect(body.settings).toEqual({ sound: false });
    expect(body.lessons?.l1?.mastery).toBe(0.5);
  });
});

describe("mergeProgressSnapshots current behaviour", () => {
  it("current behaviour (later PR will change this): streak takes the max", () => {
    expect(mergeProgressSnapshots({ streak: 12 }, { streak: 3 }).streak).toBe(12);
    expect(mergeProgressSnapshots({ streak: 2 }, { streak: 9 }).streak).toBe(9);
  });

  it("current behaviour (later PR will change this): rating takes the max, and a missing rating counts as 800", () => {
    expect(mergeProgressSnapshots({ rating: 1500 }, { rating: 1100 }).rating).toBe(
      1500,
    );
    expect(mergeProgressSnapshots({ rating: 700 }, { rating: 1200 }).rating).toBe(1200);
    expect(mergeProgressSnapshots({ rating: 500 }, {}).rating).toBe(800);
  });

  it("current behaviour (later PR will change this): dailyGoalXp takes the max, and a missing goal counts as 50", () => {
    expect(
      mergeProgressSnapshots({ dailyGoalXp: 120 }, { dailyGoalXp: 60 }).dailyGoalXp,
    ).toBe(120);
    expect(
      mergeProgressSnapshots({ dailyGoalXp: 40 }, { dailyGoalXp: 100 }).dailyGoalXp,
    ).toBe(100);
    expect(mergeProgressSnapshots({ dailyGoalXp: 20 }, {}).dailyGoalXp).toBe(50);
  });

  it("current behaviour (later PR will change this): mistakeLog keeps server entries first", () => {
    const merged = mergeProgressSnapshots(
      {
        mistakeLog: [
          mistake("shared", 1, "local-move"),
          mistake("local-only", 2, "a2a3"),
        ],
      },
      {
        mistakeLog: [
          mistake("server-only", 3, "c2c3"),
          mistake("shared", 1, "server-move"),
        ],
      },
    );

    expect(merged.mistakeLog).toEqual([
      mistake("server-only", 3, "c2c3"),
      mistake("shared", 1, "server-move"),
      mistake("local-only", 2, "a2a3"),
    ]);
  });

  it("current behaviour (later PR will change this): mistakeLog stays capped at 30 with the server prefix kept", () => {
    const serverLog = Array.from({ length: 20 }, (_, i) => mistake(`s${i}`, i));
    const localLog = Array.from({ length: 15 }, (_, i) => mistake(`l${i}`, 100 + i));
    const merged = mergeProgressSnapshots(
      { mistakeLog: localLog },
      { mistakeLog: serverLog },
    );

    expect(merged.mistakeLog).toHaveLength(30);
    expect(merged.mistakeLog?.map((m) => m.fen)).toEqual([
      ...serverLog.map((m) => m.fen),
      ...localLog.slice(0, 10).map((m) => m.fen),
    ]);
  });

  it("current behaviour (later PR will change this): dailyPuzzleDay prefers the server day", () => {
    expect(
      mergeProgressSnapshots(
        { dailyPuzzleDay: "2026-06-15" },
        { dailyPuzzleDay: "2026-01-01" },
      ).dailyPuzzleDay,
    ).toBe("2026-01-01");
    expect(
      mergeProgressSnapshots({ dailyPuzzleDay: "2026-06-15" }, { dailyPuzzleDay: null })
        .dailyPuzzleDay,
    ).toBe("2026-06-15");
    expect(mergeProgressSnapshots({}, {}).dailyPuzzleDay).toBeNull();
  });

  it("max-merges xp and maps, prefers local lastActiveDay, and keeps the higher-mastery lesson", () => {
    const merged = mergeProgressSnapshots(
      {
        xp: 40,
        lastActiveDay: "2026-06-01",
        botWins: 2,
        placementDone: false,
        weaknesses: { pin: 2, fork: 1 },
        activityDays: { "2026-06-01": 40 },
        lessons: {
          a: { mastery: 0.4, attempts: 2, lastSeen: 1, dueAt: 2 },
          b: { mastery: 0.9, attempts: 1, lastSeen: 3, dueAt: 4 },
        },
      },
      {
        xp: 25,
        lastActiveDay: "2026-06-20",
        botWins: 5,
        placementDone: true,
        weaknesses: { fork: 4 },
        activityDays: { "2026-06-01": 10, "2026-06-20": 8 },
        lessons: {
          a: { mastery: 0.8, attempts: 1, lastSeen: 5, dueAt: 6 },
          b: { mastery: 0.2, attempts: 4, lastSeen: 7, dueAt: 8 },
        },
      },
    );

    expect(merged.xp).toBe(40);
    expect(merged.botWins).toBe(5);
    expect(merged.lastActiveDay).toBe("2026-06-01");
    expect(merged.placementDone).toBe(true);
    expect(merged.weaknesses).toEqual({ pin: 2, fork: 4 });
    expect(merged.activityDays).toEqual({ "2026-06-01": 40, "2026-06-20": 8 });
    expect(merged.lessons?.a).toEqual({
      mastery: 0.8,
      attempts: 2,
      lastSeen: 5,
      dueAt: 6,
    });
    expect(merged.lessons?.b).toEqual({
      mastery: 0.9,
      attempts: 4,
      lastSeen: 3,
      dueAt: 4,
    });
  });

  it("current behaviour (later PR will change this): equal lesson mastery keeps the server record", () => {
    const merged = mergeProgressSnapshots(
      { lessons: { a: { mastery: 0.5, attempts: 3, lastSeen: 1, dueAt: 2 } } },
      { lessons: { a: { mastery: 0.5, attempts: 1, lastSeen: 9, dueAt: 10 } } },
    );
    expect(merged.lessons?.a).toEqual({
      mastery: 0.5,
      attempts: 3,
      lastSeen: 9,
      dueAt: 10,
    });
  });
});
