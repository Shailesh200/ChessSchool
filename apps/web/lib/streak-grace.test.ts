import { describe, expect, it } from "vitest";
import { addDays, isCalendarDay, isoDay } from "@chess-school/progression";
import { progressPushSchema, type ProgressPushBody } from "@/lib/api-schemas";
import {
  mergeExtraData,
  mergeProgressPush,
  type MergedProgressWrite,
  type ServerProgressState,
} from "@/lib/progress-merge";
import {
  STREAK_ACTIVE_DAY_LIMIT,
  STREAK_GRACE_WINDOW,
  isInsideStreakGraceWindow,
  parseStreakGrace,
  recomputeStreakFromActiveDays,
  readStoredStreakGrace,
  recordableActivityDay,
  serverUtcDay,
  streakGraceStart,
  type StreakGrace,
} from "@/lib/streak-grace";

const START = "2026-10-20";
const T = "2026-10-22";

const emptyServer: ServerProgressState = {
  xp: 0,
  streak: 0,
  lastActiveDay: null,
  dailyGoalXp: 50,
  graduatedClasses: [],
  lessons: {},
  extra: {},
};

function push(
  partial: Partial<ProgressPushBody> & Record<string, unknown>,
): ProgressPushBody {
  return {
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    graduatedClasses: [],
    lessons: {},
    ...partial,
  } as ProgressPushBody;
}

function asServer(merged: MergedProgressWrite): ServerProgressState {
  return {
    xp: merged.xp,
    streak: merged.streak,
    lastActiveDay: merged.lastActiveDay,
    dailyGoalXp: merged.dailyGoalXp,
    graduatedClasses: merged.graduatedClasses,
    lessons: merged.lessons,
    extra: merged.data,
  };
}

function lesson(attempts = 1, mastery = 1) {
  return { mastery, attempts, lastSeen: 1, dueAt: 2 };
}

describe("streak grace window", () => {
  it("is 7 days beginning on an explicit start", () => {
    expect(STREAK_GRACE_WINDOW.lengthDays).toBe(7);
    const start = "2026-10-25";
    expect(isInsideStreakGraceWindow(start, start)).toBe(true);
    expect(isInsideStreakGraceWindow(addDays(start, 6), start)).toBe(true);
    expect(isInsideStreakGraceWindow(addDays(start, 7), start)).toBe(false);
    expect(isInsideStreakGraceWindow(addDays(start, -1), start)).toBe(false);
    expect(serverUtcDay(new Date("2026-10-22T23:30:00.000Z"))).toBe(
      isoDay(new Date("2026-10-22T23:30:00.000Z"), "UTC"),
    );
  });

  it("rejects dates that are not real calendar days", () => {
    expect(isCalendarDay("2026-10-22")).toBe(true);
    expect(isCalendarDay("2026-02-30")).toBe(false);
    expect(isCalendarDay("10/22/2026")).toBe(false);
    expect(isInsideStreakGraceWindow("not-a-day", START)).toBe(false);
    expect(recordableActivityDay("2026-02-30", T)).toBeNull();
    expect(recordableActivityDay(T, T)).toBe(T);
    expect(recordableActivityDay(addDays(T, -1), T)).toBe(addDays(T, -1));
    expect(recordableActivityDay(addDays(T, 1), T)).toBe(addDays(T, 1));
    expect(recordableActivityDay(addDays(T, -2), T)).toBeNull();
    expect(recordableActivityDay(addDays(T, 2), T)).toBeNull();
  });

  it("disables grace when STREAK_GRACE_START is unset or invalid", () => {
    const previous = process.env.STREAK_GRACE_START;
    try {
      delete process.env.STREAK_GRACE_START;
      expect(streakGraceStart()).toBeNull();
      expect(streakGraceStart("")).toBeNull();
      expect(streakGraceStart("nope")).toBeNull();
      for (const bad of ["tomorrow", "2026-02-30", "2026-10-2", "   "]) {
        process.env.STREAK_GRACE_START = bad;
        expect(streakGraceStart()).toBeNull();
      }
      process.env.STREAK_GRACE_START = START;
      expect(streakGraceStart("nope")).toBeNull();
      expect(streakGraceStart(" 2026-11-02 ")).toBe("2026-11-02");

      process.env.STREAK_GRACE_START = "not-a-date";
      const played = mergeProgressPush(
        push({ xp: 15, streak: 1, lastActiveDay: T }),
        {
          ...emptyServer,
          xp: 10,
          streak: 4,
          lastActiveDay: addDays(T, -2),
        },
        { today: T },
      );
      expect(played.data.streakGrace?.graceUsedAt).toBeUndefined();
      expect(played.streak).toBe(1);
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });
});

describe("active-day streak", () => {
  it("recomputes the streak from the server's stored active days", () => {
    expect(
      recomputeStreakFromActiveDays([addDays(T, -2), T], T, { allowGrace: true }),
    ).toEqual({ streak: 3, coveredDay: addDays(T, -1) });
    expect(
      recomputeStreakFromActiveDays([addDays(T, -2), T], T, {
        allowGrace: false,
        graceCoveredDay: addDays(T, -1),
      }),
    ).toEqual({ streak: 3, coveredDay: addDays(T, -1) });
    expect(recomputeStreakFromActiveDays([addDays(T, -1), T], T)).toEqual({
      streak: 2,
    });
    expect(recomputeStreakFromActiveDays([T], "not-a-day")).toEqual({ streak: 0 });
  });

  it("seeds old rows from lastActiveDay and streak, then bridges one gap", () => {
    const merged = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: T }),
      { ...emptyServer, xp: 10, streak: 4, lastActiveDay: addDays(T, -2) },
      { today: T, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toEqual([
      addDays(T, -5),
      addDays(T, -4),
      addDays(T, -3),
      addDays(T, -2),
      T,
    ]);
    expect(merged.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(merged.data.streakGrace?.graceUsedAt).toBe(T);
    expect(merged.streak).toBe(6);
  });

  it("keeps at most 60 active days", () => {
    const today = T;
    const merged = mergeProgressPush(
      push({ xp: 1, streak: 1, lastActiveDay: today }),
      { ...emptyServer, streak: 80, lastActiveDay: today },
      { today, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toHaveLength(STREAK_ACTIVE_DAY_LIMIT);
    expect(merged.data.streakGrace?.activeDays?.[0]).toBe(
      addDays(today, -(STREAK_ACTIVE_DAY_LIMIT - 1)),
    );
    expect(merged.streak).toBe(STREAK_ACTIVE_DAY_LIMIT);
  });

  it("a settings-only push recomputes the streak from the set", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 20,
      streak: 2,
      lastActiveDay: T,
      extra: { streakGrace: { activeDays: [addDays(T, -1), T] } },
    };
    const merged = mergeProgressPush(
      push({
        xp: 20,
        streak: 50,
        lastActiveDay: T,
        settings: { sound: false },
      }),
      server,
      { today: T, graceStart: START },
    );
    expect(merged.streak).toBe(2);
    expect(merged.streak).not.toBe(50);
    expect(merged.data.streakGrace?.activeDays).toEqual([addDays(T, -1), T]);
    expect(merged.data.settings).toEqual({ sound: false });
  });

  it("an activity push stores the streak the set supports, not the client number", () => {
    const merged = mergeProgressPush(
      push({ xp: 30, streak: 50, lastActiveDay: T }),
      {
        ...emptyServer,
        xp: 20,
        streak: 2,
        lastActiveDay: T,
        extra: { streakGrace: { activeDays: [addDays(T, -1), T] } },
      },
      { today: T, graceStart: START },
    );
    expect(merged.streak).toBe(2);
    expect(merged.streak).not.toBe(50);
    expect(merged.data.streakGrace?.activeDays).toEqual([addDays(T, -1), T]);
  });

  it("ignores a client streak of 60 and seeds only from the server streak", () => {
    const merged = mergeProgressPush(
      push({ xp: 10, streak: 60, lastActiveDay: T }),
      { ...emptyServer, streak: 2, lastActiveDay: T },
      { today: T, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toEqual([addDays(T, -1), T]);
    expect(merged.streak).toBe(2);
    expect(merged.streak).not.toBe(60);
  });

  it("records play at 00:30 IST on the client's local day", () => {
    // 2026-10-23 00:30 IST is 2026-10-22 19:00 UTC. The local day is server UTC + 1.
    const now = new Date("2026-10-22T19:00:00.000Z");
    const utc = isoDay(now, "UTC");
    const local = isoDay(now, "Asia/Kolkata");
    expect(utc).toBe("2026-10-22");
    expect(local).toBe("2026-10-23");
    const merged = mergeProgressPush(
      push({ xp: 10, streak: 60, lastActiveDay: local }),
      emptyServer,
      { today: utc, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toEqual([local]);
    expect(merged.streak).toBe(1);
    expect(merged.streak).not.toBe(60);

    const settings = mergeProgressPush(
      push({ xp: 10, streak: 60, lastActiveDay: local, settings: { sound: false } }),
      asServer(merged),
      { today: utc, graceStart: START },
    );
    expect(settings.data.streakGrace?.activeDays).toEqual([local]);
    expect(settings.streak).toBe(1);
    expect(settings.data.streakGrace?.graceUsedAt).toBeUndefined();
  });

  it("records play at 05:00 IST on the client's local day", () => {
    // 2026-10-23 05:00 IST is 2026-10-22 23:30 UTC, still the local day ahead of UTC.
    const now = new Date("2026-10-22T23:30:00.000Z");
    const utc = isoDay(now, "UTC");
    const local = isoDay(now, "Asia/Kolkata");
    expect(utc).toBe("2026-10-22");
    expect(local).toBe("2026-10-23");
    const merged = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: local }),
      emptyServer,
      { today: utc, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toEqual([local]);
    expect(merged.streak).toBe(1);
  });

  it("does not backfill yesterday; grace is the only way a missed day counts", () => {
    const early = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -2) }),
      emptyServer,
      { today: addDays(T, -2), graceStart: START },
    );
    const played = mergeProgressPush(
      push({ xp: 20, streak: 60, lastActiveDay: T }),
      asServer(early),
      { today: T, graceStart: START },
    );
    expect(played.data.streakGrace?.activeDays).toEqual([addDays(T, -2), T]);
    expect(played.data.streakGrace?.activeDays).not.toContain(addDays(T, -1));
    expect(played.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(played.data.streakGrace?.graceUsedAt).toBe(T);
    expect(played.streak).toBe(3);
    expect(played.streak).not.toBe(60);

    const backfill = mergeProgressPush(
      push({
        xp: 30,
        streak: 60,
        lastActiveDay: addDays(T, -1),
        lessons: { catchup: lesson() },
      }),
      asServer(played),
      { today: T, graceStart: START },
    );
    expect(backfill.data.streakGrace?.activeDays).toEqual([addDays(T, -2), T]);
    expect(backfill.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(backfill.data.streakGrace?.graceUsedAt).toBe(T);
    expect(backfill.streak).toBe(3);
    expect(backfill.lessons.catchup?.attempts).toBe(1);
  });

  it("A: a settings push on T-1 does not block grace for a play on T", () => {
    const played = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -2) }),
      emptyServer,
      { today: addDays(T, -2), graceStart: START },
    );
    expect(played.data.streakGrace?.activeDays).toEqual([addDays(T, -2)]);

    const settings = mergeProgressPush(
      push({
        xp: 10,
        streak: 1,
        lastActiveDay: addDays(T, -2),
        settings: { sound: false },
        homeworkDone: { warmup: ["s1"] },
        journalEntries: [
          {
            id: "j1",
            day: addDays(T, -1),
            date: 1,
            kind: "reflection",
            title: "Note",
            confidence: 3,
            note: "plan",
            summary: "s",
            ref: null,
          },
        ],
      }),
      asServer(played),
      { today: addDays(T, -1), graceStart: START },
    );
    expect(settings.data.streakGrace?.activeDays).toEqual([addDays(T, -2)]);
    expect(settings.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(settings.data.settings).toEqual({ sound: false });

    const again = mergeProgressPush(
      push({ xp: 25, streak: 1, lastActiveDay: T }),
      asServer(settings),
      { today: T, graceStart: START },
    );
    expect(again.data.streakGrace?.activeDays).toEqual([addDays(T, -2), T]);
    expect(again.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(again.data.streakGrace?.graceUsedAt).toBe(T);
    expect(again.streak).toBe(3);
  });

  it("B: a no-activity push on T-2 does not earn grace after a T-5 play", () => {
    const played = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -5) }),
      emptyServer,
      { today: addDays(T, -5), graceStart: START },
    );
    const idle = mergeProgressPush(
      push({
        xp: 10,
        streak: 9,
        lastActiveDay: addDays(T, -2),
        settings: { theme: "night" },
      }),
      asServer(played),
      { today: addDays(T, -2), graceStart: START },
    );
    expect(idle.data.streakGrace?.activeDays).toEqual([addDays(T, -5)]);
    expect(idle.data.streakGrace?.graceUsedAt).toBeUndefined();

    const later = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: T }),
      asServer(idle),
      { today: T, graceStart: START },
    );
    expect(later.data.streakGrace?.activeDays).toEqual([addDays(T, -5), T]);
    expect(later.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(later.streak).toBe(1);
  });

  it("an offline claim of yesterday does not backfill the day already played", () => {
    const web = mergeProgressPush(
      push({ xp: 40, streak: 1, lastActiveDay: T }),
      emptyServer,
      { today: T, graceStart: START },
    );
    expect(web.streak).toBe(1);
    expect(web.data.streakGrace?.graceUsedAt).toBeUndefined();

    const phone = mergeProgressPush(
      push({
        xp: 40,
        streak: 1,
        lastActiveDay: addDays(T, -1),
        lessons: { "offline-lesson": lesson() },
      }),
      asServer(web),
      { today: T, graceStart: START },
    );
    expect(phone.data.streakGrace?.activeDays).toEqual([T]);
    expect(phone.streak).toBe(1);
    expect(phone.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(phone.lessons["offline-lesson"]?.attempts).toBe(1);
  });

  it("keeps grace when a later push claims the covered day", () => {
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -2) }),
      emptyServer,
      { today: addDays(T, -2), graceStart: START },
    );
    const graced = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: T }),
      asServer(first),
      { today: T, graceStart: START },
    );
    expect(graced.streak).toBe(3);
    expect(graced.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(graced.data.streakGrace?.graceUsedAt).toBe(T);

    const replay = mergeProgressPush(
      push({
        xp: 30,
        streak: 1,
        lastActiveDay: addDays(T, -1),
        lessons: { catchup: lesson() },
      }),
      asServer(graced),
      { today: T, graceStart: START },
    );
    expect(replay.streak).toBe(graced.streak);
    expect(replay.data.streakGrace?.activeDays).toEqual([addDays(T, -2), T]);
    expect(replay.data.streakGrace?.graceUsedAt).toBe(T);
    expect(replay.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(replay.lessons.catchup?.attempts).toBe(1);
  });

  it("keeps a graced length when a later push recomputes the set", () => {
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -2) }),
      emptyServer,
      { today: addDays(T, -2), graceStart: START },
    );
    const graced = mergeProgressPush(
      push({ xp: 20, streak: 50, lastActiveDay: T }),
      asServer(first),
      { today: T, graceStart: START },
    );
    expect(graced.streak).toBe(3);

    const settings = mergeProgressPush(
      push({ xp: 20, streak: 50, lastActiveDay: T, settings: { sound: false } }),
      asServer(graced),
      { today: T, graceStart: START },
    );
    expect(settings.streak).toBe(3);
    expect(settings.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
    expect(settings.data.streakGrace?.activeDays).not.toContain(addDays(T, -1));

    const again = mergeProgressPush(
      push({ xp: 30, streak: 50, lastActiveDay: T }),
      asServer(settings),
      { today: T, graceStart: START },
    );
    expect(again.streak).toBe(3);
    expect(again.data.streakGrace?.graceCoveredDay).toBe(addDays(T, -1));
  });

  it("ignores a replay that claims T-2 or a future day", () => {
    const web = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: T }),
      emptyServer,
      { today: T, graceStart: START },
    );
    const both = mergeProgressPush(
      push({
        xp: 10,
        streak: 1,
        lastActiveDay: addDays(T, -1),
        botWins: 1,
      }),
      asServer(web),
      { today: T, graceStart: START },
    );
    expect(both.data.streakGrace?.activeDays).toEqual([T]);
    expect(both.streak).toBe(1);

    const oldDay = mergeProgressPush(
      push({ xp: 50, streak: 99, lastActiveDay: addDays(T, -2) }),
      asServer(both),
      { today: T, graceStart: START },
    );
    expect(oldDay.data.streakGrace?.activeDays).toEqual(
      both.data.streakGrace?.activeDays,
    );
    expect(oldDay.streak).toBe(both.streak);
    expect(oldDay.data.streakGrace?.graceUsedAt).toBeUndefined();

    const future = mergeProgressPush(
      push({ xp: 60, streak: 99, lastActiveDay: "2099-01-01" }),
      asServer(oldDay),
      { today: T, graceStart: START },
    );
    expect(future.data.streakGrace?.activeDays).toEqual(
      both.data.streakGrace?.activeDays,
    );
    expect(future.streak).toBe(both.streak);
    expect(future.lastActiveDay).not.toBe("2099-01-01");
    expect(future.data.streakGrace?.activeDays ?? []).not.toContain("2099-01-01");
  });

  it("counts a new puzzle day or a new game, and ignores a repeat", () => {
    const puzzled = mergeProgressPush(
      push({ xp: 0, streak: 1, lastActiveDay: T, dailyPuzzleDay: T }),
      emptyServer,
      { today: T, graceStart: START },
    );
    expect(puzzled.data.streakGrace?.activeDays).toEqual([T]);

    const repeat = mergeProgressPush(
      push({
        xp: 0,
        streak: 1,
        lastActiveDay: addDays(T, -1),
        dailyPuzzleDay: T,
        recentGames: [{ id: "g1", result: "win" }],
      }),
      {
        ...asServer(puzzled),
        extra: { ...puzzled.data, recentGames: [{ id: "g1", result: "win" }] },
      },
      { today: T, graceStart: START },
    );
    expect(repeat.data.streakGrace?.activeDays).toEqual([T]);

    const game = mergeProgressPush(
      push({
        xp: 0,
        streak: 1,
        lastActiveDay: addDays(T, 1),
        dailyPuzzleDay: "nope",
        recentGames: [{ id: "g1", result: "win" }, { result: "loss" }],
      }),
      asServer(repeat),
      { today: T, graceStart: START },
    );
    expect(game.data.streakGrace?.activeDays).toEqual([T, addDays(T, 1)]);
  });

  it("[accepted-risk: Arc 2026-10-26, follow-up D5] a higher XP with no completion still counts as activity", () => {
    // Progress is client-reported. XP (and botWins, lesson counters, puzzle
    // day, game ids) are compared to the stored snapshot, so a crafted bump
    // counts even when the server never saw a lesson, puzzle, or game.
    // Verifying a real completion needs server-recorded completions (D5).
    const merged = mergeProgressPush(
      push({ xp: 11, streak: 4, lastActiveDay: T, lessons: {} }),
      { ...emptyServer, xp: 10, streak: 0, lastActiveDay: null },
      { today: T, graceStart: START },
    );
    expect(merged.data.streakGrace?.activeDays).toEqual([T]);
    expect(merged.streak).toBe(1);
    expect(merged.lessons).toEqual({});

    const byCount = mergeProgressPush(
      push({ xp: 11, streak: 60, lastActiveDay: T, botWins: 1 }),
      asServer(merged),
      { today: T, graceStart: START },
    );
    expect(byCount.data.streakGrace?.activeDays).toEqual([T]);
    expect(byCount.streak).toBe(1);

    const yesterday = mergeProgressPush(
      push({ xp: 11, streak: 60, lastActiveDay: addDays(T, -1), botWins: 2 }),
      asServer(byCount),
      { today: T, graceStart: START },
    );
    expect(yesterday.data.streakGrace?.activeDays).toEqual([T]);
    expect(yesterday.streak).toBe(1);
  });

  it("[IST, pending D2c] one local miss can look like two missed UTC days", () => {
    // IST is UTC+5:30. Local 2026-10-20 01:00 is UTC 2026-10-19 19:30.
    // Local 2026-10-22 23:00 is UTC 2026-10-22 17:30. The player missed only
    // local 2026-10-21, but the UTC set skips 2026-10-20 and 2026-10-21.
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: "2026-10-19" }),
      emptyServer,
      { today: "2026-10-19", graceStart: START },
    );
    const second = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: "2026-10-22" }),
      asServer(first),
      { today: "2026-10-22", graceStart: START },
    );
    expect(second.data.streakGrace?.activeDays).toEqual(["2026-10-19", "2026-10-22"]);
    expect(second.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(second.streak).toBe(1);
  });

  it("[IST, pending D2c] one local miss that is one UTC miss is graced", () => {
    // Local 10:00 IST is 04:30 UTC the same date. Missing local 2026-10-21
    // is also the only missed UTC day, so grace bridges it.
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: "2026-10-20" }),
      emptyServer,
      { today: "2026-10-20", graceStart: START },
    );
    const second = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: "2026-10-22" }),
      asServer(first),
      { today: "2026-10-22", graceStart: START },
    );
    expect(second.data.streakGrace?.graceCoveredDay).toBe("2026-10-21");
    expect(second.data.streakGrace?.graceUsedAt).toBe("2026-10-22");
    expect(second.streak).toBe(3);
  });

  it("[IST, pending D2c] consecutive local days that skip a UTC day are graced", () => {
    // Local 2026-10-20 01:00 IST is UTC 2026-10-19. Local 2026-10-21 23:00 IST
    // is UTC 2026-10-21. No local day was missed, but UTC missed 2026-10-20.
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: "2026-10-19" }),
      emptyServer,
      { today: "2026-10-19", graceStart: "2026-10-19" },
    );
    const second = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: "2026-10-21" }),
      asServer(first),
      { today: "2026-10-21", graceStart: "2026-10-19" },
    );
    expect(second.data.streakGrace?.graceCoveredDay).toBe("2026-10-20");
    expect(second.streak).toBe(3);
  });

  it("does not grace a second gap, and does not grace outside the window", () => {
    const first = mergeProgressPush(
      push({ xp: 10, streak: 1, lastActiveDay: addDays(T, -2) }),
      emptyServer,
      { today: addDays(T, -2), graceStart: START },
    );
    const graced = mergeProgressPush(
      push({ xp: 20, streak: 1, lastActiveDay: T }),
      asServer(first),
      { today: T, graceStart: START },
    );
    const later = addDays(T, 2);
    const secondGap = mergeProgressPush(
      push({ xp: 30, streak: 1, lastActiveDay: later }),
      asServer(graced),
      { today: later, graceStart: START },
    );
    expect(secondGap.data.streakGrace?.graceUsedAt).toBe(T);
    expect(secondGap.streak).toBe(1);

    const outside = addDays(START, STREAK_GRACE_WINDOW.lengthDays);
    const blocked = mergeProgressPush(
      push({ xp: 15, streak: 1, lastActiveDay: outside }),
      { ...emptyServer, xp: 5, streak: 2, lastActiveDay: addDays(outside, -2) },
      { today: outside, graceStart: START },
    );
    expect(blocked.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(blocked.streak).toBe(1);
  });

  it("does not store a lastActiveDay past server UTC +1", () => {
    const kept = mergeProgressPush(
      push({ streak: 9, lastActiveDay: "2026-10-25" }),
      { ...emptyServer, streak: 3, lastActiveDay: "2026-10-21" },
      { today: T, graceStart: START },
    );
    expect(kept.lastActiveDay).toBe("2026-10-21");
    expect(kept.streak).toBe(9);
    expect(kept.data.streakGrace?.activeDays ?? []).not.toContain("2026-10-25");

    const neither = mergeProgressPush(
      push({ lastActiveDay: "2099-01-01" }),
      { ...emptyServer, lastActiveDay: "2099-06-01" },
      { today: T, graceStart: START },
    );
    expect(neither.lastActiveDay).toBeNull();
  });

  it("Test A: an old client that omits streakGrace does not wipe the set", () => {
    const stored: StreakGrace = {
      activeDays: [addDays(T, -1), T],
      graceUsedAt: "2026-10-18",
    };
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 20,
      streak: 2,
      lastActiveDay: T,
      extra: { streakGrace: stored, weaknesses: { fork: 2 } },
    };
    const body = push({
      xp: 20,
      streak: 2,
      lastActiveDay: T,
      settings: { sound: true },
    });
    expect(body).not.toHaveProperty("streakGrace");
    const merged = mergeProgressPush(body, server, { today: T, graceStart: START });
    expect(merged.data.streakGrace).toEqual(stored);
    expect(merged.data.weaknesses).toEqual({ fork: 2 });
  });

  it("Test B: a client cannot write or clear the active-day set", () => {
    const stored: StreakGrace = {
      activeDays: [T],
      graceUsedAt: "2026-10-18",
      graceCoveredDay: addDays(T, -1),
    };
    expect(
      mergeExtraData(
        { streakGrace: stored },
        { streakGrace: { activeDays: ["2099-01-01"], graceUsedAt: "1999-01-01" } },
      ).streakGrace,
    ).toEqual(stored);
    expect(
      mergeExtraData({}, { streakGrace: { activeDays: [T] } as never }).streakGrace,
    ).toBeUndefined();

    const merged = mergeProgressPush(
      push({
        xp: 5,
        streak: 9,
        lastActiveDay: T,
        streakGrace: { activeDays: ["2020-01-01"], graceUsedAt: null, usedOn: null },
      }),
      {
        ...emptyServer,
        xp: 5,
        streak: 1,
        lastActiveDay: T,
        extra: { streakGrace: { usedOn: "2026-10-18" } as unknown as StreakGrace },
      },
      { today: T, graceStart: START },
    );
    expect(merged.data.streakGrace?.graceUsedAt).toBe("2026-10-18");
    expect(merged.data.streakGrace?.activeDays).toBeUndefined();
    expect(merged.streak).toBe(9);
  });

  it("does not read streakGrace from the push schema", () => {
    const parsed = progressPushSchema.safeParse({
      xp: 1,
      streak: 1,
      lastActiveDay: T,
      graduatedClasses: [],
      lessons: {},
      streakGrace: { activeDays: [T], graceUsedAt: "1999-01-01", usedOn: "1999-01-01" },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("streakGrace");
  });

  it("uses STREAK_GRACE_START from the environment during merge", () => {
    const previous = process.env.STREAK_GRACE_START;
    process.env.STREAK_GRACE_START = START;
    try {
      const merged = mergeProgressPush(
        push({ xp: 20, streak: 1, lastActiveDay: T }),
        { ...emptyServer, xp: 10, streak: 1, lastActiveDay: addDays(T, -2) },
        { today: T },
      );
      expect(merged.streak).toBe(3);
      expect(merged.data.streakGrace?.graceUsedAt).toBe(T);
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });
});

describe("readStoredStreakGrace", () => {
  it("migrates usedOn and drops days that are not calendar days", () => {
    expect(readStoredStreakGrace(undefined)).toBeUndefined();
    expect(readStoredStreakGrace(null)).toBeUndefined();
    expect(readStoredStreakGrace({ used: false })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: "2026-02-30" })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: T })).toEqual({ graceUsedAt: T });
    expect(readStoredStreakGrace({ graceUsedAt: "2026-02-30", usedOn: T })).toEqual({
      graceUsedAt: T,
    });
    expect(
      readStoredStreakGrace({
        graceUsedAt: "2026-10-18",
        usedOn: T,
        graceCoveredDay: addDays(T, -1),
        activeDays: [T, "2026-02-30", T],
      }),
    ).toEqual({
      graceUsedAt: "2026-10-18",
      graceCoveredDay: addDays(T, -1),
      activeDays: [T],
    });
    expect(parseStreakGrace({ activeDays: [] }).hasActiveDays).toBe(true);
    expect(parseStreakGrace({ usedOn: T }).hasActiveDays).toBe(false);
  });
});
