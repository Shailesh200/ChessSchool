import { describe, it, expect } from "vitest";
import {
  mergeExtraData,
  mergeProgressPush,
  type ServerProgressState,
} from "./progress-merge";
import type { ProgressPushBody } from "@/lib/api-schemas";

const emptyServer: ServerProgressState = {
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  dailyGoalXp: 50,
  graduatedClasses: [],
  lessons: {},
  extra: {},
};

function push(partial: Partial<ProgressPushBody>): ProgressPushBody {
  return {
    xp: partial.xp ?? 0,
    streak: partial.streak ?? 0,
    lastActiveDay: partial.lastActiveDay ?? null,
    graduatedClasses: partial.graduatedClasses ?? [],
    lessons: partial.lessons ?? {},
    ...partial,
  };
}

describe("mergeProgressPush", () => {
  it("partial POST with empty lessons preserves server lesson records", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      lessons: {
        "board-basics": { mastery: 0.9, attempts: 3, lastSeen: 100, dueAt: 200 },
        "pawn-power": { mastery: 0.6, attempts: 2, lastSeen: 50, dueAt: 150 },
      },
    };
    const merged = mergeProgressPush(push({ xp: 120, lessons: {} }), server);
    expect(Object.keys(merged.lessons)).toEqual(["board-basics", "pawn-power"]);
    expect(merged.lessons["board-basics"]?.mastery).toBe(0.9);
  });

  it("stale lower XP cannot overwrite higher server XP", () => {
    const server = { ...emptyServer, xp: 500, streak: 7 };
    const merged = mergeProgressPush(push({ xp: 100, streak: 2 }), server);
    expect(merged.xp).toBe(500);
    expect(merged.streak).toBe(7);
  });

  it("incoming XP/streak above server are kept", () => {
    const server = { ...emptyServer, xp: 100, streak: 2 };
    const merged = mergeProgressPush(push({ xp: 250, streak: 5 }), server);
    expect(merged.xp).toBe(250);
    expect(merged.streak).toBe(5);
  });

  it("keeps higher server mastery when client sends a stale lower value", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      lessons: {
        fork: { mastery: 0.85, attempts: 4, lastSeen: 1000, dueAt: 2000 },
      },
    };
    const merged = mergeProgressPush(
      push({
        lessons: {
          fork: { mastery: 0.4, attempts: 5, lastSeen: 900, dueAt: 1800 },
        },
      }),
      server,
    );
    expect(merged.lessons.fork?.mastery).toBe(0.85);
    expect(merged.lessons.fork?.attempts).toBe(5);
  });

  it("unions graduatedClasses instead of replacing server graduations", () => {
    const server = { ...emptyServer, graduatedClasses: ["class-pieces"] };
    const merged = mergeProgressPush(
      push({ graduatedClasses: ["class-tactics"] }),
      server,
    );
    expect(merged.graduatedClasses.sort()).toEqual(["class-pieces", "class-tactics"]);
  });

  it("merges a new incoming lesson without dropping existing server lessons", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      lessons: {
        a: { mastery: 1, attempts: 1, lastSeen: 1, dueAt: 2 },
      },
    };
    const merged = mergeProgressPush(
      push({
        lessons: {
          b: { mastery: 0.5, attempts: 1, lastSeen: 3, dueAt: 4 },
        },
      }),
      server,
    );
    expect(merged.lessons.a?.mastery).toBe(1);
    expect(merged.lessons.b?.mastery).toBe(0.5);
  });

  it("max-merges homeworkDone session lists per homework type", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: { homeworkDone: { warmup: ["s1", "s2"] } },
    };
    const merged = mergeProgressPush(
      push({ homeworkDone: { warmup: ["s2", "s3"], practice: ["p1"] } }),
      server,
    );
    expect(merged.data.homeworkDone?.warmup?.sort()).toEqual(["s1", "s2", "s3"]);
    expect(merged.data.homeworkDone?.practice).toEqual(["p1"]);
  });

  it("merges journal entries by id and keeps placementDone once true", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: {
        placementDone: false,
        journalEntries: [
          {
            id: "j1",
            day: "2026-07-08",
            date: 0,
            kind: "reflection",
            title: "Old",
            confidence: 2,
            note: "old",
            summary: "s",
            ref: null,
          },
        ],
      },
    };
    const merged = mergeProgressPush(
      push({
        placementDone: true,
        journalEntries: [
          {
            id: "j1",
            day: "2026-07-09",
            date: 1,
            kind: "reflection",
            title: "Day 1",
            confidence: 4,
            note: "new",
            summary: "s",
            ref: null,
          },
          {
            id: "j2",
            day: "2026-07-09",
            date: 2,
            kind: "lesson",
            title: "Day 2",
            confidence: 3,
            note: "fresh",
            summary: "s2",
            ref: null,
          },
        ],
      }),
      server,
    );
    expect(merged.data.placementDone).toBe(true);
    const entries = merged.data.journalEntries as Array<{ id: string; note: string }>;
    expect(entries.find((e) => e.id === "j1")?.note).toBe("new");
    expect(entries.find((e) => e.id === "j2")?.note).toBe("fresh");
  });

  it("dedupes recentGames and shallow-merges settings", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: {
        settings: { sound: true, theme: "day" },
        recentGames: [{ id: "g1", result: "win" }],
      },
    };
    const merged = mergeProgressPush(
      push({
        settings: { haptics: false, theme: "night" },
        recentGames: [
          { id: "g1", result: "win" },
          { id: "g2", result: "loss" },
        ],
      }),
      server,
    );
    expect(merged.data.settings).toEqual({
      sound: true,
      theme: "night",
      haptics: false,
    });
    expect(merged.data.recentGames).toHaveLength(2);
  });

  it("preserves server-only extra fields when incoming omits them", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: {
        unlockedAchievements: ["first-win"],
        weaknesses: { fork: 2 },
        activityDays: { "2026-07-09": 40 },
      },
    };
    const merged = mergeProgressPush(push({ xp: 10 }), server);
    expect(merged.data.unlockedAchievements).toEqual(["first-win"]);
    expect(merged.data.weaknesses).toEqual({ fork: 2 });
    expect(merged.data.activityDays).toEqual({ "2026-07-09": 40 });
  });

  it("max-merges weaknesses and homework streak from incoming", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: { weaknesses: { fork: 1 }, homeworkStreak: 2 },
    };
    const merged = mergeProgressPush(
      push({ homeworkStreak: 5, weaknesses: { pin: 3, fork: 1 } }),
      server,
    );
    expect(merged.data.weaknesses).toEqual({ fork: 1, pin: 3 });
    expect(merged.data.homeworkStreak).toBe(5);
  });
});

describe("recency merge", () => {
  const today = "2026-10-22";
  const opts = { today, graceStart: "2099-01-01" };

  function withGraceOff(run: () => void) {
    const previous = process.env.STREAK_GRACE_START;
    process.env.STREAK_GRACE_START = "2099-01-01";
    try {
      run();
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  }

  it("syncs a broken streak, a rating drop, and a lowered goal", () => {
    withGraceOff(() => {
      const merged = mergeProgressPush(
        push({
          streak: 1,
          lastActiveDay: today,
          rating: 1400,
          ratingUpdatedAt: 2_000,
          dailyGoalXp: 30,
          goalUpdatedAt: 2_000,
          homeworkStreak: 1,
          homeworkLastDay: today,
        }),
        {
          ...emptyServer,
          streak: 9,
          lastActiveDay: "2026-10-20",
          extra: {
            rating: 1600,
            ratingUpdatedAt: 1_000,
            dailyGoalXp: 80,
            goalUpdatedAt: 1_000,
            homeworkStreak: 6,
            homeworkLastDay: "2026-10-18",
          },
        },
        opts,
      );
      expect(merged.streak).toBe(1);
      expect(merged.lastActiveDay).toBe(today);
      expect(merged.data.rating).toBe(1400);
      expect(merged.data.ratingUpdatedAt).toBe(2_000);
      expect(merged.dailyGoalXp).toBe(30);
      expect(merged.data.goalUpdatedAt).toBe(2_000);
      expect(merged.data.homeworkStreak).toBe(1);
      expect(merged.data.homeworkLastDay).toBe(today);
    });
  });

  it("keeps max rating and goal for an old client with no timestamps", () => {
    withGraceOff(() => {
      const merged = mergeProgressPush(
        push({
          rating: 900,
          dailyGoalXp: 40,
          streak: 2,
          lastActiveDay: today,
        }),
        {
          ...emptyServer,
          streak: 6,
          lastActiveDay: today,
          extra: { rating: 1200, dailyGoalXp: 80 },
        },
        opts,
      );
      expect(merged.data.rating).toBe(1200);
      expect(merged.dailyGoalXp).toBe(80);
      expect(merged.data.ratingUpdatedAt).toBeUndefined();
      expect(merged.data.goalUpdatedAt).toBeUndefined();
      expect(merged.streak).toBe(6);
    });
  });

  it("rejects a far-future or malformed lastActiveDay", () => {
    withGraceOff(() => {
      const future = mergeProgressPush(
        push({ streak: 40, lastActiveDay: "2027-01-01" }),
        { ...emptyServer, streak: 3, lastActiveDay: today },
        opts,
      );
      expect(future.streak).toBe(3);
      expect(future.lastActiveDay).toBe(today);

      const malformed = mergeProgressPush(
        push({ streak: 12, lastActiveDay: "2026-02-30" }),
        { ...emptyServer, streak: 2, lastActiveDay: "2026-10-21" },
        opts,
      );
      expect(malformed.streak).toBe(2);
      expect(malformed.lastActiveDay).toBe("2026-10-21");

      // No stored day to compare against: the future claim still must not win the tie.
      const unanchored = mergeProgressPush(
        push({ streak: 40, lastActiveDay: "2027-01-01" }),
        { ...emptyServer, streak: 2, lastActiveDay: null },
        opts,
      );
      expect(unanchored.streak).toBe(2);
      expect(unanchored.lastActiveDay).toBeNull();

      // A valid older day does not replace a newer stored day.
      const older = mergeProgressPush(
        push({ streak: 9, lastActiveDay: "2026-10-20" }),
        { ...emptyServer, streak: 4, lastActiveDay: today },
        opts,
      );
      expect(older.streak).toBe(4);
      expect(older.lastActiveDay).toBe(today);

      // A stored day ahead of the incoming local day is the same day, not a gap.
      const ahead = mergeProgressPush(
        push({ streak: 1, lastActiveDay: today }),
        { ...emptyServer, streak: 4, lastActiveDay: "2026-10-23" },
        opts,
      );
      expect(ahead.streak).toBe(4);
      expect(ahead.lastActiveDay).toBe("2026-10-23");
    });
  });

  it("stores tz without letting it choose the streak day", () => {
    withGraceOff(() => {
      const merged = mergeProgressPush(
        push({
          streak: 1,
          lastActiveDay: today,
          tz: "Asia/Kolkata",
        }),
        { ...emptyServer, streak: 4, lastActiveDay: "2026-10-20" },
        opts,
      );
      expect(merged.data.tz).toBe("Asia/Kolkata");
      expect(merged.streak).toBe(1);
      expect(merged.lastActiveDay).toBe(today);
    });
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
    const merged = mergeProgressPush(
      push({ mistakeLog: newer, dailyPuzzleDay: "2026-06-15" }),
      {
        ...emptyServer,
        extra: { mistakeLog: older, dailyPuzzleDay: "2026-01-01" },
      },
      opts,
    );
    expect(merged.data.mistakeLog).toHaveLength(30);
    expect((merged.data.mistakeLog as Array<{ at: number }>)[0]?.at).toBe(114);
    expect(merged.data.dailyPuzzleDay).toBe("2026-06-15");
  });

  it("ends on the same values when two devices push in either order", () => {
    withGraceOff(() => {
      const deviceA = push({
        xp: 100,
        streak: 5,
        lastActiveDay: "2026-10-20",
        rating: 1500,
        ratingUpdatedAt: 1_000,
        dailyGoalXp: 80,
        goalUpdatedAt: 2_000,
        homeworkStreak: 4,
        homeworkLastDay: "2026-10-20",
      });
      const deviceB = push({
        xp: 40,
        streak: 1,
        lastActiveDay: today,
        rating: 1400,
        ratingUpdatedAt: 3_000,
        dailyGoalXp: 30,
        goalUpdatedAt: 1_000,
        homeworkStreak: 1,
        homeworkLastDay: today,
      });
      const asServer = (
        merged: ReturnType<typeof mergeProgressPush>,
      ): ServerProgressState => ({
        xp: merged.xp,
        streak: merged.streak,
        lastActiveDay: merged.lastActiveDay,
        dailyGoalXp: merged.dailyGoalXp,
        graduatedClasses: merged.graduatedClasses,
        lessons: merged.lessons,
        extra: merged.data,
      });
      const ab = mergeProgressPush(
        deviceB,
        asServer(mergeProgressPush(deviceA, emptyServer, opts)),
        opts,
      );
      const ba = mergeProgressPush(
        deviceA,
        asServer(mergeProgressPush(deviceB, emptyServer, opts)),
        opts,
      );
      expect(ab.streak).toBe(ba.streak);
      expect(ab.streak).toBe(1);
      expect(ab.data.rating).toBe(1400);
      expect(ba.data.rating).toBe(1400);
      expect(ab.dailyGoalXp).toBe(80);
      expect(ba.dailyGoalXp).toBe(80);
      expect(ab.data.homeworkStreak).toBe(1);
      expect(ba.data.homeworkStreak).toBe(1);
      expect(ab.xp).toBe(100);
      expect(ba.xp).toBe(100);
    });
  });
});

describe("mergeExtraData", () => {
  it("keeps previous arrays when incoming omits them", () => {
    const prev = {
      unlockedAchievements: ["a"],
      schoolExamsPassed: ["elem"],
      mistakeLog: [{ fen: "x", at: 1 }],
      recentGames: [{ id: 1 }],
      journalEntries: [{ id: "j1" }],
    };
    expect(mergeExtraData(prev, {})).toMatchObject({
      unlockedAchievements: ["a"],
      schoolExamsPassed: ["elem"],
      mistakeLog: [{ fen: "x", at: 1 }],
      recentGames: [{ id: 1 }],
      journalEntries: [{ id: "j1" }],
    });
  });

  it("unions incoming arrays and merges numeric maps", () => {
    const merged = mergeExtraData(
      { weaknesses: { fork: 2 }, activityDays: { "2026-07-01": 10 } },
      {
        unlockedAchievements: ["b"],
        schoolExamsPassed: ["mid"],
        weaknesses: { pin: 1 },
        activityDays: { "2026-07-01": 5, "2026-07-02": 8 },
        mistakeLog: [{ fen: "y", at: 2 }],
      },
    );
    expect(merged.unlockedAchievements).toEqual(["b"]);
    expect(merged.schoolExamsPassed).toEqual(["mid"]);
    expect(merged.weaknesses).toEqual({ fork: 2, pin: 1 });
    expect(merged.activityDays).toEqual({ "2026-07-01": 10, "2026-07-02": 8 });
    expect(merged.mistakeLog).toEqual([{ fen: "y", at: 2 }]);
  });
});

describe("progress parsers", () => {
  it("parseGraduatedClasses returns [] on corrupt JSON", async () => {
    const { parseGraduatedClasses, parseExtraData, serverStateFromRow } =
      await import("./progress-merge");
    expect(parseGraduatedClasses("not-json")).toEqual([]);
    expect(parseExtraData("{bad")).toEqual({});
    const state = serverStateFromRow(
      {
        xp: 10,
        streak: 1,
        lastActiveDay: "2026-07-09",
        dailyGoalXp: 50,
        graduatedClasses: "[]",
        data: "{}",
      },
      [{ lessonId: "x", mastery: 1, attempts: 1, lastSeen: 1, dueAt: 2 }],
    );
    expect(state.lessons.x?.mastery).toBe(1);
    expect(state.xp).toBe(10);
  });
});
