import { describe, expect, it } from "vitest";
import {
  applyProgressPushAck,
  mergeProgressSnapshots,
  readProgressPushAck,
  type Snap,
} from "./index";

type MergeSnap = Snap & {
  placementDone?: boolean;
  ratingUpdatedAt?: number;
  goalUpdatedAt?: number;
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
  dailyGoalXp?: number;
  dailyPuzzleDay?: string | null;
};

const DAYS = [null, "2026-10-18", "2026-10-20", "2026-10-22", "2026-10-23", "2099-01-01", "nope"];

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rand: () => number, values: T[]): T {
  return values[Math.floor(rand() * values.length)]!;
}

function snap(rand: () => number): MergeSnap {
  const lessons: MergeSnap["lessons"] = {};
  if (rand() > 0.4) {
    lessons.a = {
      mastery: pick(rand, [0.2, 0.5, 0.9]),
      attempts: pick(rand, [1, 2, 4]),
      lastSeen: pick(rand, [1, 9]),
      dueAt: pick(rand, [2, 10]),
      incorrect: pick(rand, [0, 2]),
    };
  }
  const ratingAt = rand() > 0.5 ? pick(rand, [100, 200, 200]) : undefined;
  const goalAt = rand() > 0.5 ? pick(rand, [100, 400]) : undefined;
  return {
    xp: pick(rand, [0, 10, 40, 100]),
    streak: pick(rand, [0, 1, 4, 9]),
    lastActiveDay: pick(rand, DAYS),
    rating: pick(rand, [500, 800, 1200, 1500]),
    ...(ratingAt !== undefined ? { ratingUpdatedAt: ratingAt } : {}),
    botWins: pick(rand, [0, 2, 7]),
    dailyGoalXp: pick(rand, [20, 50, 80]),
    ...(goalAt !== undefined ? { goalUpdatedAt: goalAt } : {}),
    homeworkStreak: pick(rand, [0, 1, 3]),
    homeworkLastDay: pick(rand, DAYS),
    dailyPuzzleDay: pick(rand, [null, "2026-01-01", "2026-06-15"]),
    placementDone: rand() > 0.5,
    graduatedClasses: rand() > 0.5 ? ["class-a"] : ["class-b"],
    unlockedAchievements: rand() > 0.5 ? ["first"] : [],
    weaknesses: { fork: pick(rand, [0, 2, 4]) },
    activityDays: { "2026-10-20": pick(rand, [0, 10, 40]) },
    mistakeLog: [
      { fen: "shared", played: pick(rand, ["a2a3", "b2b3"]), best: "d2d4", tag: "fork", at: 10 },
      { fen: `m${Math.floor(rand() * 40)}`, played: "e2e4", best: "d2d4", tag: "pin", at: Math.floor(rand() * 50) },
    ],
    lessons,
  };
}

function canon(s: MergeSnap) {
  const lessons = Object.fromEntries(
    Object.entries(s.lessons ?? {}).sort(([a], [b]) => (a < b ? -1 : 1)),
  );
  return {
    ...s,
    graduatedClasses: [...(s.graduatedClasses ?? [])].sort(),
    unlockedAchievements: [...(s.unlockedAchievements ?? [])].sort(),
    schoolExamsPassed: [...(s.schoolExamsPassed ?? [])].sort(),
    lessons,
    ratingUpdatedAt: s.ratingUpdatedAt ?? null,
    goalUpdatedAt: s.goalUpdatedAt ?? null,
  };
}

describe("mergeProgressSnapshots recency", () => {
  it("is commutative across random snapshot pairs", () => {
    const today = "2026-10-22";
    for (let seed = 1; seed <= 80; seed += 1) {
      const rand = mulberry32(seed);
      const left = snap(rand);
      const right = snap(rand);
      const forward = canon(mergeProgressSnapshots(left, right, { today }));
      const backward = canon(mergeProgressSnapshots(right, left, { today }));
      expect(forward, `seed ${seed}`).toEqual(backward);
      const untimed = canon(mergeProgressSnapshots(left, right));
      expect(untimed, `seed ${seed} without a clock`).toEqual(
        canon(mergeProgressSnapshots(right, left)),
      );
    }
  });

  it("syncs a streak break from the newer lastActiveDay", () => {
    const merged = mergeProgressSnapshots(
      { streak: 1, lastActiveDay: "2026-10-22" },
      { streak: 9, lastActiveDay: "2026-10-20" },
      { today: "2026-10-22" },
    );
    expect(merged.streak).toBe(1);
    expect(merged.lastActiveDay).toBe("2026-10-22");
  });

  it("keeps the larger streak when the day ties", () => {
    const merged = mergeProgressSnapshots(
      { streak: 2, lastActiveDay: "2026-10-22" },
      { streak: 8, lastActiveDay: "2026-10-22" },
    );
    expect(merged.streak).toBe(8);
    expect(merged.lastActiveDay).toBe("2026-10-22");
  });

  it("does not let a far-future or malformed day win recency", () => {
    const today = "2026-10-22";
    const future = mergeProgressSnapshots(
      { streak: 40, lastActiveDay: "2027-01-01" },
      { streak: 3, lastActiveDay: today },
      { today },
    );
    expect(future.streak).toBe(3);
    expect(future.lastActiveDay).toBe(today);

    const malformed = mergeProgressSnapshots(
      { streak: 12, lastActiveDay: "tomorrow" },
      { streak: 2, lastActiveDay: "2026-10-21" },
      { today },
    );
    expect(malformed.streak).toBe(2);
    expect(malformed.lastActiveDay).toBe("2026-10-21");

    const tomorrow = mergeProgressSnapshots(
      { streak: 2, lastActiveDay: "2026-10-23" },
      { streak: 7, lastActiveDay: today },
      { today },
    );
    expect(tomorrow.streak).toBe(2);
    expect(tomorrow.lastActiveDay).toBe("2026-10-23");

    const dayAfter = mergeProgressSnapshots(
      { streak: 9, lastActiveDay: "2026-10-24" },
      { streak: 4, lastActiveDay: today },
      { today },
    );
    expect(dayAfter.streak).toBe(4);
    expect(dayAfter.lastActiveDay).toBe(today);
  });

  it("syncs a rating drop and a lowered goal by timestamp", () => {
    const merged = mergeProgressSnapshots(
      { rating: 1400, ratingUpdatedAt: 2_000, dailyGoalXp: 30, goalUpdatedAt: 2_000 },
      { rating: 1600, ratingUpdatedAt: 1_000, dailyGoalXp: 80, goalUpdatedAt: 1_000 },
    );
    expect(merged.rating).toBe(1400);
    expect(merged.ratingUpdatedAt).toBe(2_000);
    expect(merged.dailyGoalXp).toBe(30);
    expect(merged.goalUpdatedAt).toBe(2_000);
  });

  it("lets a present timestamp beat a higher value with no timestamp", () => {
    const merged = mergeProgressSnapshots(
      { rating: 900, ratingUpdatedAt: 50, dailyGoalXp: 20, goalUpdatedAt: 50 },
      { rating: 1500, dailyGoalXp: 100 },
    );
    expect(merged.rating).toBe(900);
    expect(merged.dailyGoalXp).toBe(20);
  });

  it("keeps max rating and goal when both timestamps are missing", () => {
    const merged = mergeProgressSnapshots(
      { rating: 700, dailyGoalXp: 20 },
      { rating: 1200, dailyGoalXp: 80 },
    );
    expect(merged.rating).toBe(1200);
    expect(merged.dailyGoalXp).toBe(80);
    expect(mergeProgressSnapshots({ rating: 500 }, {}).rating).toBe(800);
    expect(mergeProgressSnapshots({ dailyGoalXp: 20 }, {}).dailyGoalXp).toBe(50);
  });

  it("keeps the max value when writer timestamps tie", () => {
    const merged = mergeProgressSnapshots(
      { rating: 1100, ratingUpdatedAt: 40, dailyGoalXp: 40, goalUpdatedAt: 40 },
      { rating: 1300, ratingUpdatedAt: 40, dailyGoalXp: 90, goalUpdatedAt: 40 },
    );
    expect(merged.rating).toBe(1300);
    expect(merged.dailyGoalXp).toBe(90);
  });

  it("syncs a homework streak from the newer homework day", () => {
    const merged = mergeProgressSnapshots(
      { homeworkStreak: 1, homeworkLastDay: "2026-10-22" },
      { homeworkStreak: 6, homeworkLastDay: "2026-10-18" },
      { today: "2026-10-22" },
    );
    expect(merged.homeworkStreak).toBe(1);
    expect(merged.homeworkLastDay).toBe("2026-10-22");
  });

  it("unions activity and keeps the max xp and bot wins", () => {
    const merged = mergeProgressSnapshots(
      { xp: 10, botWins: 1, activityDays: { "2026-10-22": 5 } },
      { xp: 40, botWins: 3, activityDays: { "2026-10-22": 12, "2026-10-20": 8 } },
    );
    expect(merged.xp).toBe(40);
    expect(merged.botWins).toBe(3);
    expect(merged.activityDays).toEqual({ "2026-10-22": 12, "2026-10-20": 8 });
  });

  it("keeps the newest 30 mistakes and the newest puzzle day", () => {
    const older = Array.from({ length: 20 }, (_, i) => ({
      fen: `s${i}`,
      played: "e2e4",
      best: "d2d4",
      tag: "fork",
      at: i,
    }));
    const newer = Array.from({ length: 15 }, (_, i) => ({
      fen: `l${i}`,
      played: "a2a3",
      best: "d2d4",
      tag: "pin",
      at: 100 + i,
    }));
    const merged = mergeProgressSnapshots(
      { mistakeLog: newer, dailyPuzzleDay: "2026-06-15" },
      { mistakeLog: older, dailyPuzzleDay: "2026-01-01" },
    );
    expect(merged.mistakeLog).toHaveLength(30);
    expect(merged.mistakeLog?.[0]?.at).toBe(114);
    expect(merged.mistakeLog?.some((m) => m.fen === "s4")).toBe(false);
    expect(merged.mistakeLog?.some((m) => m.fen === "s5")).toBe(true);
    expect(merged.dailyPuzzleDay).toBe("2026-06-15");
    expect(
      mergeProgressSnapshots({ dailyPuzzleDay: "2026-06-15" }, { dailyPuzzleDay: null })
        .dailyPuzzleDay,
    ).toBe("2026-06-15");
  });

  it("two devices reach the same snapshot either push order", () => {
    const start: MergeSnap = { xp: 0, streak: 0, rating: 800, dailyGoalXp: 50 };
    const deviceA: MergeSnap = {
      xp: 100,
      streak: 5,
      lastActiveDay: "2026-10-20",
      rating: 1500,
      ratingUpdatedAt: 1_000,
      dailyGoalXp: 80,
      goalUpdatedAt: 2_000,
      homeworkStreak: 4,
      homeworkLastDay: "2026-10-20",
    };
    const deviceB: MergeSnap = {
      xp: 40,
      streak: 1,
      lastActiveDay: "2026-10-22",
      rating: 1400,
      ratingUpdatedAt: 3_000,
      dailyGoalXp: 30,
      goalUpdatedAt: 1_000,
      homeworkStreak: 1,
      homeworkLastDay: "2026-10-22",
    };
    const today = { today: "2026-10-22" };
    const afterA = mergeProgressSnapshots(deviceA, start, today);
    const afterAB = mergeProgressSnapshots(deviceB, afterA, today);
    const afterB = mergeProgressSnapshots(deviceB, start, today);
    const afterBA = mergeProgressSnapshots(deviceA, afterB, today);
    expect(canon(afterAB)).toEqual(canon(afterBA));
    expect(afterAB.rating).toBe(1400);
    expect(afterAB.streak).toBe(1);
    expect(afterAB.dailyGoalXp).toBe(80);
    expect(afterAB.homeworkStreak).toBe(1);
    expect(afterAB.xp).toBe(100);
  });
});

describe("progress push ack", () => {
  it("adopts merged fields and ignores an old ok/count body", () => {
    expect(readProgressPushAck({ ok: true, count: 3 })).toBeNull();
    const local = { streak: 1, lastActiveDay: "2026-10-20", rating: 1500, dailyGoalXp: 80, homeworkStreak: 4, xp: 10 };
    expect(applyProgressPushAck(local, { ok: true, count: 3 })).toEqual(local);
    expect(
      applyProgressPushAck(local, {
        ok: true,
        count: 3,
        streak: 6,
        lastActiveDay: "2026-10-22",
        rating: 1400,
        dailyGoalXp: 30,
        homeworkStreak: 1,
      }),
    ).toEqual({
      streak: 6,
      lastActiveDay: "2026-10-22",
      rating: 1400,
      dailyGoalXp: 30,
      homeworkStreak: 1,
      xp: 10,
    });
  });
});
