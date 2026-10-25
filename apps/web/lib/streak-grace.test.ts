import { describe, expect, it } from "vitest";
import { addDays, isoDay } from "@chess-school/progression";
import { progressPushSchema, type ProgressPushBody } from "@/lib/api-schemas";
import {
  mergeExtraData,
  mergeProgressPush,
  type ServerProgressState,
} from "@/lib/progress-merge";
import {
  STREAK_GRACE_WINDOW,
  applyOneTimeStreakGrace,
  isInsideStreakGraceWindow,
  isRealIsoDay,
  isWithinServerUtcSkew,
  readStoredStreakGrace,
  serverUtcDay,
  streakGraceStart,
  type StreakGraceInput,
} from "@/lib/streak-grace";

const START = "2026-10-20";
const STORED_DAY = "2026-10-20";
const MISSED_DAY = "2026-10-21";
const TODAY = "2026-10-22";

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

function graceInput(partial: Partial<StreakGraceInput> = {}): StreakGraceInput {
  return {
    storedStreak: 4,
    storedLastActiveDay: STORED_DAY,
    incomingStreak: 1,
    incomingLastActiveDay: TODAY,
    mergedStreak: partial.mergedStreak ?? Math.max(4, partial.incomingStreak ?? 1),
    today: TODAY,
    graceStart: START,
    ...partial,
  };
}

/**
 * Production merge takes the streak from the side with the newer lastActiveDay.
 * A tie (same day) keeps the larger streak. Tests that call grace directly
 * pass this result in as `mergedStreak`.
 */
function streakFromNewerLastActiveDay(
  stored: { streak: number; lastActiveDay: string | null },
  incoming: { streak: number; lastActiveDay: string | null },
): number {
  const storedDay = stored.lastActiveDay;
  const incomingDay = incoming.lastActiveDay;
  if (storedDay && incomingDay && storedDay === incomingDay) {
    return Math.max(stored.streak, incoming.streak);
  }
  if (incomingDay && (!storedDay || incomingDay > storedDay)) return incoming.streak;
  if (storedDay && (!incomingDay || storedDay > incomingDay)) return stored.streak;
  return Math.max(stored.streak, incoming.streak);
}

describe("streak grace window", () => {
  it("is 7 days beginning on an explicit start", () => {
    expect(STREAK_GRACE_WINDOW.lengthDays).toBe(7);

    const start = "2026-10-25";
    expect(isInsideStreakGraceWindow(start, start)).toBe(true);
    expect(isInsideStreakGraceWindow(addDays(start, 6), start)).toBe(true);
    expect(isInsideStreakGraceWindow(addDays(start, 7), start)).toBe(false);
    expect(isInsideStreakGraceWindow(addDays(start, -1), start)).toBe(false);
    expect(isWithinServerUtcSkew(TODAY, TODAY)).toBe(true);
    expect(isWithinServerUtcSkew(addDays(TODAY, 1), TODAY)).toBe(true);
    expect(isWithinServerUtcSkew(addDays(TODAY, -1), TODAY)).toBe(true);
    expect(isWithinServerUtcSkew(addDays(TODAY, 2), TODAY)).toBe(false);
    expect(serverUtcDay(new Date("2026-10-22T23:30:00.000Z"))).toBe(
      isoDay(new Date("2026-10-22T23:30:00.000Z"), "UTC"),
    );
  });

  it("rejects dates that are not real calendar days", () => {
    expect(isRealIsoDay("2026-10-22")).toBe(true);
    expect(isRealIsoDay("2026-02-30")).toBe(false);
    expect(isRealIsoDay("10/22/2026")).toBe(false);
    expect(isInsideStreakGraceWindow("not-a-day", START)).toBe(false);
    expect(isInsideStreakGraceWindow(TODAY, "2026-13-40")).toBe(false);
  });

  it("disables grace when STREAK_GRACE_START is unset", () => {
    const previous = process.env.STREAK_GRACE_START;
    try {
      delete process.env.STREAK_GRACE_START;
      expect(streakGraceStart()).toBeNull();
      expect(streakGraceStart("")).toBeNull();
      expect(streakGraceStart("   ")).toBeNull();

      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: TODAY }),
        { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
        { today: TODAY },
      );
      // Grace is off, so the newer day's reset is stored. It is not the old max of 4, and not 5.
      expect(merged.streak).toBe(1);
      expect(merged.streak).not.toBe(5);
      expect(merged.data.streakGrace).toBeUndefined();
      expect(merged.lastActiveDay).toBe(TODAY);
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });

  it("disables grace when STREAK_GRACE_START is invalid", () => {
    const previous = process.env.STREAK_GRACE_START;
    try {
      for (const bad of ["tomorrow", "2026-02-30", "2026-10-2", "   "]) {
        process.env.STREAK_GRACE_START = bad;
        expect(streakGraceStart()).toBeNull();
      }
      expect(streakGraceStart("nope")).toBeNull();
      process.env.STREAK_GRACE_START = START;
      expect(streakGraceStart("nope")).toBeNull();
      expect(streakGraceStart(" 2026-11-02 ")).toBe("2026-11-02");

      process.env.STREAK_GRACE_START = "not-a-date";
      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: TODAY }),
        { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
        { today: TODAY },
      );
      expect(merged.streak).toBe(1);
      expect(merged.streak).not.toBe(5);
      expect(merged.data.streakGrace).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });
});

describe("applyOneTimeStreakGrace", () => {
  it("applies grace once when exactly one calendar day was missed", () => {
    const result = applyOneTimeStreakGrace(graceInput());
    expect(MISSED_DAY).toBe(addDays(STORED_DAY, 1));
    expect(result.streak).toBe(5);
    expect(result.streakGrace).toEqual({ usedOn: TODAY });
  });

  it("does not grace a second missed day", () => {
    const second = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: 5,
        storedLastActiveDay: TODAY,
        incomingStreak: 1,
        incomingLastActiveDay: "2026-10-24",
        mergedStreak: 5,
        storedGrace: { usedOn: TODAY },
        today: "2026-10-24",
      }),
    );
    expect(second.streak).toBe(5);
    expect(second.streakGrace).toEqual({ usedOn: TODAY });
  });

  it("does not grace outside the window", () => {
    const outside = addDays(START, STREAK_GRACE_WINDOW.lengthDays);
    const result = applyOneTimeStreakGrace(
      graceInput({
        storedLastActiveDay: addDays(outside, -2),
        incomingLastActiveDay: outside,
        today: outside,
        mergedStreak: 1,
      }),
    );
    expect(isInsideStreakGraceWindow(outside, START)).toBe(false);
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toBeUndefined();
  });

  it("does not grace a two-day gap", () => {
    const incomingDay = addDays(STORED_DAY, 3);
    const result = applyOneTimeStreakGrace(
      graceInput({
        incomingLastActiveDay: incomingDay,
        today: incomingDay,
        mergedStreak: 1,
      }),
    );
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toBeUndefined();
  });

  it("does not consume grace on a consecutive day or when nothing was stored", () => {
    const consecutive = applyOneTimeStreakGrace(
      graceInput({
        storedLastActiveDay: "2026-10-21",
        incomingStreak: 1,
        mergedStreak: 4,
      }),
    );
    expect(consecutive.streak).toBe(4);
    expect(consecutive.streakGrace).toBeUndefined();

    const noStreak = applyOneTimeStreakGrace(
      graceInput({ storedStreak: 0, mergedStreak: 1 }),
    );
    expect(noStreak.streak).toBe(1);
    expect(noStreak.streakGrace).toBeUndefined();

    const notAReset = applyOneTimeStreakGrace(
      graceInput({ incomingStreak: 2, mergedStreak: 4 }),
    );
    expect(notAReset.streak).toBe(4);
    expect(notAReset.streakGrace).toBeUndefined();

    const missingDay = applyOneTimeStreakGrace(
      graceInput({ storedLastActiveDay: null, mergedStreak: 4 }),
    );
    expect(missingDay.streak).toBe(4);
    expect(missingDay.streakGrace).toBeUndefined();

    const invalidStoredDay = applyOneTimeStreakGrace(
      graceInput({ storedLastActiveDay: "2026-02-30", mergedStreak: 4 }),
    );
    expect(invalidStoredDay.streakGrace).toBeUndefined();

    const invalidIncomingDay = applyOneTimeStreakGrace(
      graceInput({ incomingLastActiveDay: "nope", mergedStreak: 4 }),
    );
    expect(invalidIncomingDay.streakGrace).toBeUndefined();

    const missingIncomingDay = applyOneTimeStreakGrace(
      graceInput({ incomingLastActiveDay: null, mergedStreak: 4 }),
    );
    expect(missingIncomingDay.streak).toBe(4);
    expect(missingIncomingDay.streakGrace).toBeUndefined();
  });

  it("still graces when merged streak is the newer day's reset (D3 recency)", () => {
    const stored = { streak: 4, lastActiveDay: STORED_DAY };
    const incoming = { streak: 1, lastActiveDay: TODAY };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(1);

    const result = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        storedLastActiveDay: stored.lastActiveDay,
        incomingStreak: incoming.streak,
        incomingLastActiveDay: incoming.lastActiveDay,
        mergedStreak,
      }),
    );
    expect(result.streak).toBe(5);
    expect(result.streakGrace).toEqual({ usedOn: TODAY });
  });

  it("does not grace an incoming day outside the server UTC day ±1", () => {
    const result = applyOneTimeStreakGrace(
      graceInput({
        today: STORED_DAY,
        incomingLastActiveDay: TODAY,
        mergedStreak: 1,
      }),
    );
    expect(addDays(STORED_DAY, 2)).toBe(TODAY);
    expect(isWithinServerUtcSkew(TODAY, STORED_DAY)).toBe(false);
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toBeUndefined();
  });

  it("graces a day one UTC day ahead of the server", () => {
    const incoming = addDays(TODAY, 1);
    const result = applyOneTimeStreakGrace(
      graceInput({
        storedLastActiveDay: addDays(incoming, -2),
        incomingLastActiveDay: incoming,
        mergedStreak: 1,
      }),
    );
    expect(result.streak).toBe(5);
    expect(result.streakGrace).toEqual({ usedOn: TODAY });
  });

  it("keeps the newer day's reset when recency merge cannot be graced", () => {
    const stored = { streak: 5, lastActiveDay: TODAY };
    const incoming = { streak: 1, lastActiveDay: "2026-10-24" };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(1);

    const result = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        storedLastActiveDay: stored.lastActiveDay,
        incomingStreak: incoming.streak,
        incomingLastActiveDay: incoming.lastActiveDay,
        mergedStreak,
        storedGrace: { usedOn: TODAY },
        today: "2026-10-24",
      }),
    );
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toEqual({ usedOn: TODAY });
  });
});

describe("server-owned streakGrace merge", () => {
  const storedGrace = { usedOn: "2026-10-18" };

  it("applies grace on the server merge and persists it in data", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 40,
      streak: 4,
      lastActiveDay: STORED_DAY,
      extra: { unlockedAchievements: ["first-win"] },
    };
    const merged = mergeProgressPush(
      push({
        xp: 40,
        streak: 1,
        lastActiveDay: TODAY,
        streakGrace: { used: false, usedOn: "1999-01-01" },
      }),
      server,
      { today: TODAY, graceStart: START },
    );
    expect(merged.streak).toBe(5);
    expect(merged.streak).not.toBe(Math.max(server.streak, 1));
    expect(merged.lastActiveDay).toBe(TODAY);
    expect(merged.data.streakGrace).toEqual({ usedOn: TODAY });
    expect(merged.data.unlockedAchievements).toEqual(["first-win"]);
    expect(JSON.parse(JSON.stringify(merged.data)).streakGrace).toEqual({
      usedOn: TODAY,
    });
  });

  it("a crafted future day gets no grace and stores no future day", () => {
    const farmed = mergeProgressPush(
      push({ xp: 80, streak: 1, lastActiveDay: addDays(STORED_DAY, 2) }),
      { ...emptyServer, xp: 10, streak: 8, lastActiveDay: STORED_DAY },
      { today: STORED_DAY, graceStart: START },
    );
    expect(farmed.xp).toBe(80);
    expect(farmed.streak).toBe(8);
    expect(farmed.lastActiveDay).toBe(STORED_DAY);
    expect(farmed.lastActiveDay).not.toBe(addDays(STORED_DAY, 2));
    expect(farmed.data.streakGrace).toBeUndefined();

    const far = mergeProgressPush(
      push({ streak: 99, lastActiveDay: "2099-01-01" }),
      {
        ...emptyServer,
        streak: 8,
        lastActiveDay: STORED_DAY,
        extra: { streakGrace: { usedOn: "2026-10-18" } },
      },
      { today: TODAY, graceStart: START },
    );
    expect(far.streak).toBe(8);
    expect(far.lastActiveDay).toBe(STORED_DAY);
    expect(far.data.streakGrace).toEqual({ usedOn: "2026-10-18" });

    const alreadyFuture = mergeProgressPush(
      push({ streak: 1, lastActiveDay: "2099-06-01" }),
      { ...emptyServer, streak: 3, lastActiveDay: "2099-01-01" },
      { today: TODAY, graceStart: START },
    );
    expect(alreadyFuture.streak).toBe(3);
    expect(alreadyFuture.lastActiveDay).toBe(addDays(TODAY, 1));
    expect(alreadyFuture.lastActiveDay! <= addDays(TODAY, 1)).toBe(true);
  });

  it("a malformed day is ignored", () => {
    for (const bad of [
      "nope",
      "2026-02-30",
      "2026-10-2",
      "2026-10-22T00:00:00Z",
      "2026-10-22 ",
    ]) {
      const merged = mergeProgressPush(
        push({ xp: 15, streak: 99, lastActiveDay: bad }),
        { ...emptyServer, xp: 4, streak: 6, lastActiveDay: STORED_DAY },
        { today: TODAY, graceStart: START },
      );
      expect(merged.lastActiveDay).toBe(STORED_DAY);
      expect(merged.streak).toBe(6);
      expect(merged.xp).toBe(15);
      expect(merged.data.streakGrace).toBeUndefined();
    }

    const badClock = mergeProgressPush(
      push({ streak: 1, lastActiveDay: TODAY }),
      { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
      { today: "nope", graceStart: START },
    );
    expect(badClock.streak).toBe(4);
    expect(badClock.lastActiveDay).toBe(STORED_DAY);
    expect(badClock.data.streakGrace).toBeUndefined();
  });

  it("a same-day push after grace keeps the graced streak", () => {
    const first = mergeProgressPush(
      push({ streak: 1, lastActiveDay: TODAY }),
      { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
      { today: TODAY, graceStart: START },
    );
    expect(first.streak).toBe(5);
    expect(first.lastActiveDay).toBe(TODAY);
    expect(first.data.streakGrace).toEqual({ usedOn: TODAY });

    const second = mergeProgressPush(
      push({ streak: 1, lastActiveDay: TODAY }),
      {
        ...emptyServer,
        streak: first.streak,
        lastActiveDay: first.lastActiveDay,
        extra: { streakGrace: first.data.streakGrace },
      },
      { today: TODAY, graceStart: START },
    );
    expect(second.streak).toBe(5);
    expect(second.lastActiveDay).toBe(TODAY);
    expect(second.data.streakGrace).toEqual({ usedOn: TODAY });

    const stored = { streak: second.streak, lastActiveDay: TODAY };
    const incoming = { streak: 1, lastActiveDay: TODAY };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(5);

    const recency = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        storedLastActiveDay: stored.lastActiveDay,
        incomingStreak: incoming.streak,
        incomingLastActiveDay: incoming.lastActiveDay,
        mergedStreak,
        storedGrace: { usedOn: TODAY },
        today: TODAY,
      }),
    );
    expect(recency.streak).toBe(5);
    expect(recency.streakGrace).toEqual({ usedOn: TODAY });
  });

  it("does not grace outside the window on the server merge", () => {
    const outside = addDays(START, STREAK_GRACE_WINDOW.lengthDays);
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: outside }),
      { ...emptyServer, streak: 4, lastActiveDay: addDays(outside, -2) },
      { today: outside, graceStart: START },
    );
    expect(merged.data.streakGrace).toBeUndefined();
    // Grace does not apply, so the newer day's reset is what gets stored.
    expect(merged.streak).toBe(1);
    expect(merged.lastActiveDay).toBe(outside);
    expect(merged.streak).not.toBe(5);
  });

  it("does not grace a two-day gap on the server merge", () => {
    const incomingDay = addDays(STORED_DAY, 3);
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: incomingDay }),
      { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
      { today: incomingDay, graceStart: START },
    );
    expect(merged.data.streakGrace).toBeUndefined();
    expect(merged.streak).toBe(1);
    expect(merged.lastActiveDay).toBe(incomingDay);
    expect(merged.streak).not.toBe(5);
  });

  it("a second missed day is not graced by the server merge", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      streak: 5,
      lastActiveDay: TODAY,
      extra: { streakGrace: { usedOn: TODAY } },
    };
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: "2026-10-24" }),
      server,
      { today: "2026-10-24", graceStart: START },
    );
    expect(merged.data.streakGrace).toEqual({ usedOn: TODAY });
    expect(merged.streak).toBe(1);
    expect(merged.lastActiveDay).toBe("2026-10-24");
    expect(merged.streak).not.toBe(server.streak + 1);
  });

  it("Test A: an old client that omits streakGrace does not wipe a stored flag", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 20,
      streak: 4,
      lastActiveDay: TODAY,
      extra: { streakGrace: storedGrace, weaknesses: { fork: 2 } },
    };
    const body = push({ xp: 25, streak: 4, lastActiveDay: TODAY });
    expect(body).not.toHaveProperty("streakGrace");

    const merged = mergeProgressPush(body, server, { today: TODAY, graceStart: START });
    expect(merged.data.streakGrace).toEqual(storedGrace);
    expect(merged.data.weaknesses).toEqual({ fork: 2 });
    expect(mergeExtraData(server.extra, {})).toMatchObject({
      streakGrace: storedGrace,
      weaknesses: { fork: 2 },
    });
  });

  it("Test B: a client grace value is ignored and the server value stays", () => {
    const prev = { streakGrace: storedGrace, unlockedAchievements: ["a"] };
    expect(mergeExtraData(prev, { streakGrace: null } as never).streakGrace).toEqual(
      storedGrace,
    );
    expect(
      mergeExtraData(prev, { streakGrace: { used: false } } as never).streakGrace,
    ).toEqual(storedGrace);
    expect(
      mergeExtraData(prev, { streakGrace: { usedOn: "1999-01-01" } }).streakGrace,
    ).toEqual(storedGrace);
    expect(
      mergeExtraData(prev, { unlockedAchievements: ["b"] }).unlockedAchievements,
    ).toEqual(["a", "b"]);
    expect(
      mergeExtraData({}, { streakGrace: { usedOn: "1999-01-01" } }).streakGrace,
    ).toBeUndefined();

    const invented = mergeProgressPush(
      push({
        streak: 4,
        lastActiveDay: TODAY,
        streakGrace: { usedOn: "1999-01-01" },
      }),
      { ...emptyServer, streak: 4, lastActiveDay: TODAY },
      { today: TODAY, graceStart: START },
    );
    expect(invented.data.streakGrace).toBeUndefined();
    expect(invented.streak).toBe(4);

    const server: ServerProgressState = {
      ...emptyServer,
      streak: 4,
      lastActiveDay: STORED_DAY,
      extra: { streakGrace: storedGrace },
    };
    const merged = mergeProgressPush(
      push({
        streak: 1,
        lastActiveDay: TODAY,
        streakGrace: { usedOn: "1999-01-01" },
      }),
      server,
      { today: TODAY, graceStart: START },
    );
    expect(merged.data.streakGrace).toEqual(storedGrace);
    expect(merged.streak).toBe(1);
    expect(merged.lastActiveDay).toBe(TODAY);
    expect(merged.streak).not.toBe(5);
  });

  it("the flag survives a normal merge", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 10,
      streak: 4,
      lastActiveDay: "2026-10-21",
      extra: {
        streakGrace: storedGrace,
        settings: { sound: true },
        homeworkStreak: 2,
      },
      lessons: {
        a: { mastery: 1, attempts: 1, lastSeen: 1, dueAt: 2 },
      },
    };
    const merged = mergeProgressPush(
      push({
        xp: 30,
        streak: 5,
        lastActiveDay: TODAY,
        settings: { haptics: true },
        homeworkStreak: 2,
        lessons: {
          b: { mastery: 0.5, attempts: 1, lastSeen: 3, dueAt: 4 },
        },
      }),
      server,
      { today: TODAY, graceStart: START },
    );
    expect(merged.streak).toBe(5);
    expect(merged.xp).toBe(30);
    expect(merged.lessons.a?.mastery).toBe(1);
    expect(merged.lessons.b?.mastery).toBe(0.5);
    expect(merged.data.settings).toEqual({ sound: true, haptics: true });
    expect(merged.data.streakGrace).toEqual(storedGrace);
  });

  it("uses STREAK_GRACE_START from the environment during merge", () => {
    const previous = process.env.STREAK_GRACE_START;
    process.env.STREAK_GRACE_START = START;
    try {
      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: TODAY }),
        { ...emptyServer, streak: 3, lastActiveDay: STORED_DAY },
        { today: TODAY },
      );
      expect(merged.streak).toBe(4);
      expect(merged.data.streakGrace).toEqual({ usedOn: TODAY });
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });

  it("does not read streakGrace from the push schema", () => {
    const parsed = progressPushSchema.safeParse({
      xp: 1,
      streak: 1,
      lastActiveDay: TODAY,
      graduatedClasses: [],
      lessons: {},
      streakGrace: { usedOn: "1999-01-01", used: false },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("streakGrace");
  });
});

describe("readStoredStreakGrace", () => {
  it("accepts only a server-written calendar day", () => {
    expect(readStoredStreakGrace(undefined)).toBeUndefined();
    expect(readStoredStreakGrace(null)).toBeUndefined();
    expect(readStoredStreakGrace("2026-10-22")).toBeUndefined();
    expect(readStoredStreakGrace({ used: false })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: "" })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: 20261022 })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: "2026-02-30" })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: TODAY })).toEqual({ usedOn: TODAY });
  });
});
