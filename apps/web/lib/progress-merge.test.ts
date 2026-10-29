import { describe, it, expect, vi } from "vitest";
import { recomputeStreakFromActiveDays } from "./streak-grace";
import {
  mergeExtraData,
  mergeProgressPush,
  progressPushResponseBody,
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

  it("rejects a client lastActiveDay more than one day past the server UTC day", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-07-15T12:00:00.000Z"));
    const server = { ...emptyServer, lastActiveDay: "2026-07-14", streak: 3 };
    const merged = mergeProgressPush(
      push({ lastActiveDay: "2026-07-17", streak: 9 }),
      server,
    );
    expect(merged.lastActiveDay).toBe("2026-07-14");
    expect(merged.streak).toBe(3);

    const neither = mergeProgressPush(push({ lastActiveDay: "9999-12-31" }), {
      ...emptyServer,
      lastActiveDay: "2027-07-15",
    });
    expect(neither.lastActiveDay).toBeNull();

    const allowed = mergeProgressPush(push({ lastActiveDay: "2026-07-16" }), {
      ...emptyServer,
      lastActiveDay: "2026-07-14",
    });
    expect(allowed.lastActiveDay).toBe("2026-07-16");
    vi.useRealTimers();
  });

  it("incoming XP above server is kept and the client streak is ignored", () => {
    const server = { ...emptyServer, xp: 100, streak: 2 };
    const merged = mergeProgressPush(push({ xp: 250, streak: 5 }), server);
    expect(merged.xp).toBe(250);
    expect(merged.streak).toBe(2);
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
    expect(merged.data.homeworkStreak).toBe(2);
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

describe("recency fields beside the server streak", () => {
  const today = "2026-10-22";

  it("stores recomputeStreakFromActiveDays and ignores body.streak", () => {
    const merged = mergeProgressPush(
      push({ xp: 5, streak: 99, lastActiveDay: today }),
      {
        ...emptyServer,
        xp: 1,
        streak: 2,
        lastActiveDay: "2026-10-21",
        extra: { streakGrace: { activeDays: ["2026-10-20", "2026-10-21"] } },
      },
      { today, graceStart: "2099-01-01" },
    );
    const days = merged.data.streakGrace?.activeDays ?? [];
    expect(days).toEqual(["2026-10-20", "2026-10-21", today]);
    expect(merged.streak).toBe(recomputeStreakFromActiveDays(days, today).streak);
    expect(merged.streak).toBe(3);
    expect(merged.streak).not.toBe(99);
  });

  it("keeps the server homework streak and the newer homework day", () => {
    const merged = mergeProgressPush(
      push({
        homeworkStreak: 9,
        homeworkLastDay: today,
        rating: 1100,
        ratingUpdatedAt: 5_000,
        dailyGoalXp: 30,
        goalUpdatedAt: 5_000,
      }),
      {
        ...emptyServer,
        extra: {
          homeworkStreak: 2,
          homeworkLastDay: "2026-10-20",
          rating: 1600,
          ratingUpdatedAt: 1_000,
          dailyGoalXp: 80,
          goalUpdatedAt: 1_000,
        },
      },
      { today, graceStart: "2099-01-01" },
    );
    expect(merged.data.homeworkStreak).toBe(2);
    expect(merged.data.homeworkLastDay).toBe(today);
    expect(merged.data.rating).toBe(1100);
    expect(merged.data.ratingUpdatedAt).toBe(5_000);
    expect(merged.dailyGoalXp).toBe(30);
    expect(progressPushResponseBody(1, merged)).toMatchObject({
      homeworkStreak: 2,
      homeworkLastDay: today,
      rating: 1100,
      ratingUpdatedAt: 5_000,
      dailyGoalXp: 30,
      goalUpdatedAt: 5_000,
    });
  });

  it("clamps a future writer stamp and rejects a negative one", () => {
    const before = Date.now();
    const merged = mergeProgressPush(
      push({
        rating: 900,
        ratingUpdatedAt: before + 60_000,
        dailyGoalXp: 40,
        goalUpdatedAt: -5,
      }),
      {
        ...emptyServer,
        extra: {
          rating: 1400,
          ratingUpdatedAt: 1_000,
          dailyGoalXp: 80,
          goalUpdatedAt: 2_000,
        },
      },
    );
    const after = Date.now();
    expect(merged.data.rating).toBe(900);
    expect(merged.data.ratingUpdatedAt).toBeGreaterThanOrEqual(before);
    expect(merged.data.ratingUpdatedAt).toBeLessThanOrEqual(after);
    expect(merged.dailyGoalXp).toBe(80);
    expect(merged.data.goalUpdatedAt).toBe(2_000);
  });

  it("stores a canonical time zone", () => {
    const merged = mergeProgressPush(push({ tz: "Asia/Calcutta" }), emptyServer);
    expect(
      merged.data.tz === "Asia/Kolkata" || merged.data.tz === "Asia/Calcutta",
    ).toBe(true);
  });
});
