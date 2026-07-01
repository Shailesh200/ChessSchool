import { describe, it, expect } from "vitest";
import {
  isoDay,
  awardXp,
  recordLesson,
  registerActivity,
  logMistake,
  recordWeakness,
  updateRating,
  applyLessonComplete,
  applyMatchEnd,
  type Snap,
} from "./progression";
import { levelForXp, xpProgress, rankForClasses } from "./progress-utils";

const today = isoDay();
const addDays = (iso: string, d: number) => {
  const dt = new Date(iso + "T00:00:00Z");
  dt.setUTCDate(dt.getUTCDate() + d);
  return dt.toISOString().slice(0, 10);
};

describe("awardXp", () => {
  it("adds to total xp and today's activity bucket", () => {
    const s = awardXp({ xp: 10 }, 20);
    expect(s.xp).toBe(30);
    expect((s.activityDays ?? {})[today]).toBe(20);
  });
  it("accumulates within the same day", () => {
    const s = awardXp(awardXp({}, 15), 5);
    expect(s.xp).toBe(20);
    expect((s.activityDays ?? {})[today]).toBe(20);
  });
});

describe("registerActivity (streak)", () => {
  it("starts a streak at 1", () => {
    expect(registerActivity({}).streak).toBe(1);
  });
  it("increments when last active was yesterday", () => {
    const s = registerActivity({ streak: 4, lastActiveDay: addDays(today, -1) });
    expect(s.streak).toBe(5);
  });
  it("resets to 1 after a gap", () => {
    const s = registerActivity({ streak: 9, lastActiveDay: addDays(today, -3) });
    expect(s.streak).toBe(1);
  });
  it("is a no-op when already active today", () => {
    const base: Snap = { streak: 7, lastActiveDay: today };
    expect(registerActivity(base)).toBe(base);
  });
});

describe("recordLesson (mastery EWMA + spaced repetition)", () => {
  it("first attempt mastery equals the score", () => {
    const s = recordLesson({}, "l1", 4, 4);
    expect(s.lessons!.l1.mastery).toBe(1);
    expect(s.lessons!.l1.attempts).toBe(1);
  });
  it("blends prior mastery 50/50", () => {
    let s = recordLesson({}, "l1", 0, 4); // mastery 0
    s = recordLesson(s, "l1", 4, 4); // 0*0.5 + 1*0.5
    expect(s.lessons!.l1.mastery).toBe(0.5);
    expect(s.lessons!.l1.attempts).toBe(2);
  });
  it("schedules a far due date when mastered", () => {
    const s = recordLesson({}, "l1", 4, 4);
    expect(s.lessons!.l1.dueAt).toBeGreaterThan(Date.now() + 13 * 86400000);
  });
});

describe("updateRating (Elo K=32)", () => {
  it("gains ~16 on an even win and counts the win", () => {
    const s = updateRating({ rating: 800 }, 800, 1);
    expect(s.rating).toBe(816);
    expect(s.botWins).toBe(1);
  });
  it("loses on an even loss, no win counted", () => {
    const s = updateRating({ rating: 800 }, 800, 0);
    expect(s.rating).toBe(784);
    expect(s.botWins).toBe(0);
  });
  it("never drops below 100", () => {
    expect(updateRating({ rating: 100 }, 3000, 0).rating).toBeGreaterThanOrEqual(100);
  });
});

describe("logMistake / recordWeakness", () => {
  it("prepends mistakes and caps at 30", () => {
    let s: Snap = {};
    for (let i = 0; i < 35; i++) s = logMistake(s, { fen: "f", played: "a", best: "b", tag: "fork", at: i });
    expect(s.mistakeLog!.length).toBe(30);
    expect(s.mistakeLog![0].at).toBe(34); // newest first
  });
  it("tallies weaknesses by tag", () => {
    let s = recordWeakness({}, "pin");
    s = recordWeakness(s, "pin");
    expect(s.weaknesses!.pin).toBe(2);
    expect(recordWeakness(s, undefined)).toBe(s); // no tag → no-op
  });
});

describe("applyLessonComplete (integration)", () => {
  it("awards xp, sets streak, records mastery, unlocks achievements on a perfect first lesson", () => {
    const s = applyLessonComplete({}, { lessonId: "board-basics", correct: 4, total: 4, mistakes: 0, xp: 20 });
    expect(s.xp).toBe(20);
    expect(s.streak).toBe(1);
    expect(s.lessons!["board-basics"].mastery).toBe(1);
    expect((s.activityDays ?? {})[today]).toBe(20);
    expect((s.unlockedAchievements ?? []).length).toBeGreaterThan(0);
  });
});

describe("applyMatchEnd (integration)", () => {
  it("a win raises rating, grants +40 xp, and registers activity", () => {
    const s = applyMatchEnd({ rating: 800 }, { botElo: 800, result: "win" });
    expect(s.rating).toBe(816);
    expect(s.xp).toBe(40);
    expect(s.streak).toBe(1);
    expect(s.botWins).toBe(1);
  });
  it("a loss grants no xp", () => {
    const s = applyMatchEnd({ rating: 800 }, { botElo: 800, result: "loss" });
    expect(s.xp ?? 0).toBe(0);
    expect(s.rating).toBe(784);
  });
});

describe("progress-utils (levels + rank)", () => {
  it("level 1 until 100 xp, level 2 after", () => {
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(250)).toBe(3); // 100 + 150
  });
  it("xpProgress reports into/need within the level", () => {
    expect(xpProgress(0)).toEqual({ into: 0, need: 100 });
    expect(xpProgress(120)).toEqual({ into: 20, need: 150 });
  });
  it("rank ladder by graduated classes", () => {
    expect(rankForClasses(0)).toBe("Novice");
    expect(rankForClasses(1)).toBe("Pupil");
    expect(rankForClasses(6)).toBe("Scholar");
    expect(rankForClasses(100)).toBe("Master");
  });
});
