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
  isExactlyOneMissedServerDay,
  isInsideStreakGraceWindow,
  isRealIsoDay,
  readStoredStreakGrace,
  serverUtcDay,
  streakGraceStart,
  type StreakGrace,
  type StreakGraceInput,
} from "@/lib/streak-grace";

const START = "2026-10-20";
const STORED_DAY = "2026-10-20";
const MISSED_DAY = "2026-10-21";
const TODAY = "2026-10-22";
const T = TODAY;

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
  const incomingStreak = partial.incomingStreak ?? 1;
  return {
    storedStreak: 4,
    incomingStreak,
    mergedStreak: partial.mergedStreak ?? Math.max(4, incomingStreak),
    today: TODAY,
    graceStart: START,
    acceptedActivity: true,
    storedGrace: { lastSeenUtcDay: STORED_DAY },
    ...partial,
  };
}

function legacyUsed(usedOn: string, lastSeenUtcDay?: string): StreakGrace {
  return {
    usedOn,
    ...(lastSeenUtcDay ? { lastSeenUtcDay } : {}),
  } as unknown as StreakGrace;
}

/**
 * D3 will take the streak from the side with the newer lastActiveDay.
 * A tie (same day) keeps the larger streak. This is not the production
 * merge (that is still max). Tests pass its result in as `mergedStreak`.
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
        {
          ...emptyServer,
          streak: 4,
          lastActiveDay: STORED_DAY,
          extra: { streakGrace: { lastSeenUtcDay: STORED_DAY } },
        },
        { today: TODAY },
      );
      expect(merged.streak).toBe(4);
      expect(merged.streak).not.toBe(5);
      expect(merged.data.streakGrace).toEqual({ lastSeenUtcDay: TODAY });
      expect(merged.data.streakGrace?.graceUsedAt).toBeUndefined();
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
        {
          ...emptyServer,
          streak: 4,
          lastActiveDay: STORED_DAY,
          extra: { streakGrace: { lastSeenUtcDay: STORED_DAY } },
        },
        { today: TODAY },
      );
      expect(merged.streak).toBe(4);
      expect(merged.data.streakGrace?.graceUsedAt).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.STREAK_GRACE_START;
      else process.env.STREAK_GRACE_START = previous;
    }
  });
});

describe("applyOneTimeStreakGrace", () => {
  it("applies grace once when the server missed exactly one UTC day", () => {
    expect(MISSED_DAY).toBe(addDays(STORED_DAY, 1));
    expect(isExactlyOneMissedServerDay(STORED_DAY, TODAY)).toBe(true);
    const result = applyOneTimeStreakGrace(graceInput());
    expect(result.streak).toBe(5);
    expect(result.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: TODAY,
    });
  });

  it("applies grace only after exactly one missed server day", () => {
    for (const offset of [0, -1, -3, -4]) {
      const lastSeen = addDays(TODAY, offset);
      const result = applyOneTimeStreakGrace(
        graceInput({
          storedGrace: { lastSeenUtcDay: lastSeen },
          mergedStreak: 1,
        }),
      );
      expect(result.streak).toBe(1);
      expect(result.streakGrace).toEqual({ lastSeenUtcDay: TODAY });
    }

    const missing = applyOneTimeStreakGrace(
      graceInput({ storedGrace: undefined, mergedStreak: 1 }),
    );
    expect(missing.streak).toBe(1);
    expect(missing.streakGrace).toEqual({ lastSeenUtcDay: TODAY });
  });

  it("does not grace a second missed day", () => {
    const second = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: 5,
        storedGrace: { graceUsedAt: TODAY, lastSeenUtcDay: TODAY },
        today: "2026-10-24",
        mergedStreak: 1,
      }),
    );
    expect(second.streak).toBe(1);
    expect(second.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: "2026-10-24",
    });
  });

  it("does not grace outside the window", () => {
    const outside = addDays(START, STREAK_GRACE_WINDOW.lengthDays);
    const result = applyOneTimeStreakGrace(
      graceInput({
        today: outside,
        storedGrace: { lastSeenUtcDay: addDays(outside, -2) },
        mergedStreak: 1,
      }),
    );
    expect(isInsideStreakGraceWindow(outside, START)).toBe(false);
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toEqual({ lastSeenUtcDay: outside });
  });

  it("does not grace a two-day server gap", () => {
    const result = applyOneTimeStreakGrace(
      graceInput({
        storedGrace: { lastSeenUtcDay: addDays(TODAY, -3) },
        mergedStreak: 1,
      }),
    );
    expect(result.streak).toBe(1);
    expect(result.streakGrace?.graceUsedAt).toBeUndefined();
  });

  it("does not consume grace on a consecutive server day or an empty streak", () => {
    const consecutive = applyOneTimeStreakGrace(
      graceInput({
        storedGrace: { lastSeenUtcDay: "2026-10-21" },
        mergedStreak: 4,
      }),
    );
    expect(consecutive.streak).toBe(4);
    expect(consecutive.streakGrace?.graceUsedAt).toBeUndefined();

    const noStreak = applyOneTimeStreakGrace(
      graceInput({ storedStreak: 0, mergedStreak: 1 }),
    );
    expect(noStreak.streak).toBe(1);
    expect(noStreak.streakGrace?.graceUsedAt).toBeUndefined();

    const notAReset = applyOneTimeStreakGrace(
      graceInput({ incomingStreak: 2, mergedStreak: 4 }),
    );
    expect(notAReset.streak).toBe(4);
    expect(notAReset.streakGrace?.graceUsedAt).toBeUndefined();

    const idle = applyOneTimeStreakGrace(
      graceInput({ acceptedActivity: false, mergedStreak: 4 }),
    );
    expect(idle.streak).toBe(4);
    expect(idle.streakGrace).toEqual({ lastSeenUtcDay: STORED_DAY });
  });

  it("still graces when merged streak is the newer day's reset (D3 recency)", () => {
    const stored = { streak: 4, lastActiveDay: STORED_DAY };
    const incoming = { streak: 1, lastActiveDay: TODAY };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(1);

    const result = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        incomingStreak: incoming.streak,
        mergedStreak,
      }),
    );
    expect(result.streak).toBe(5);
    expect(result.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: TODAY,
    });
  });

  it("keeps the newer day's reset when recency merge cannot be graced", () => {
    const stored = { streak: 5, lastActiveDay: TODAY };
    const incoming = { streak: 1, lastActiveDay: "2026-10-24" };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(1);

    const result = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        incomingStreak: incoming.streak,
        mergedStreak,
        storedGrace: { graceUsedAt: TODAY, lastSeenUtcDay: TODAY },
        today: "2026-10-24",
        acceptedActivity: true,
      }),
    );
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: "2026-10-24",
    });
  });

  it("treats a legacy usedOn as already used", () => {
    const result = applyOneTimeStreakGrace(
      graceInput({
        storedGrace: legacyUsed("2026-10-18", STORED_DAY),
        mergedStreak: 1,
      }),
    );
    expect(result.streak).toBe(1);
    expect(result.streakGrace).toEqual({
      graceUsedAt: "2026-10-18",
      lastSeenUtcDay: TODAY,
    });
  });
});

describe("server-owned streakGrace merge", () => {
  const storedGrace = legacyUsed("2026-10-18");

  function gracedServer(
    partial: Partial<ServerProgressState> = {},
  ): ServerProgressState {
    return {
      ...emptyServer,
      streak: 4,
      lastActiveDay: STORED_DAY,
      extra: { streakGrace: { lastSeenUtcDay: STORED_DAY } },
      ...partial,
    };
  }

  it("applies grace on the server merge and persists it in data", () => {
    const server = gracedServer({
      xp: 40,
      extra: {
        streakGrace: { lastSeenUtcDay: STORED_DAY },
        unlockedAchievements: ["first-win"],
      },
    });
    const merged = mergeProgressPush(
      push({
        xp: 40,
        streak: 1,
        lastActiveDay: TODAY,
        streakGrace: { used: false, graceUsedAt: "1999-01-01", usedOn: "1999-01-01" },
      }),
      server,
      { today: TODAY, graceStart: START },
    );
    expect(merged.streak).toBe(5);
    expect(merged.streak).not.toBe(Math.max(server.streak, 1));
    expect(merged.lastActiveDay).toBe(TODAY);
    expect(merged.data.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: TODAY,
    });
    expect(merged.data.unlockedAchievements).toEqual(["first-win"]);
  });

  it("a client lastActiveDay of T-1 or T+1 does not change grace", () => {
    const server = gracedServer();
    const outcomes = [addDays(T, -1), T, addDays(T, 1)].map((day) => {
      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: day }),
        server,
        { today: T, graceStart: START },
      );
      return {
        streak: merged.streak,
        grace: merged.data.streakGrace,
      };
    });
    expect(outcomes).toEqual([
      {
        streak: 5,
        grace: { graceUsedAt: T, lastSeenUtcDay: T },
      },
      {
        streak: 5,
        grace: { graceUsedAt: T, lastSeenUtcDay: T },
      },
      {
        streak: 5,
        grace: { graceUsedAt: T, lastSeenUtcDay: T },
      },
    ]);

    const noGap = [addDays(T, -1), T, addDays(T, 1)].map((day) => {
      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: day }),
        gracedServer({
          extra: { streakGrace: { lastSeenUtcDay: addDays(T, -1) } },
        }),
        { today: T, graceStart: START },
      );
      return { streak: merged.streak, used: merged.data.streakGrace?.graceUsedAt };
    });
    expect(noGap).toEqual([
      { streak: 4, used: undefined },
      { streak: 4, used: undefined },
      { streak: 4, used: undefined },
    ]);
  });

  it("does not grace from a client day when the server has no stamp", () => {
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: TODAY }),
      { ...emptyServer, streak: 4, lastActiveDay: STORED_DAY },
      { today: TODAY, graceStart: START },
    );
    expect(addDays(STORED_DAY, 2)).toBe(TODAY);
    expect(merged.streak).toBe(4);
    expect(merged.data.streakGrace).toEqual({ lastSeenUtcDay: TODAY });
  });

  it("repro a: last server day T-3 and a client day of T-1 is two misses", () => {
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: addDays(T, -1) }),
      gracedServer({
        streak: 8,
        lastActiveDay: addDays(T, -3),
        extra: { streakGrace: { lastSeenUtcDay: addDays(T, -3) } },
      }),
      { today: T, graceStart: START },
    );
    expect(merged.streak).toBe(8);
    expect(merged.data.streakGrace).toEqual({ lastSeenUtcDay: T });
    expect(merged.lastActiveDay).toBe(addDays(T, -1));
  });

  it("repro b: last server day T-1 and a client day of T+1 is not a miss", () => {
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: addDays(T, 1) }),
      gracedServer({
        streak: 8,
        lastActiveDay: addDays(T, -1),
        extra: { streakGrace: { lastSeenUtcDay: addDays(T, -1) } },
      }),
      { today: T, graceStart: START },
    );
    expect(merged.streak).toBe(8);
    expect(merged.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(merged.data.streakGrace?.lastSeenUtcDay).toBe(T);
    expect(merged.lastActiveDay).toBe(addDays(T, 1));
  });

  it("repro c: a T-1 push does not rewind a stored T, and T+1 gets no grace", () => {
    const first = mergeProgressPush(
      push({ streak: 1, lastActiveDay: addDays(T, -1) }),
      gracedServer({
        streak: 6,
        lastActiveDay: T,
        extra: { streakGrace: { lastSeenUtcDay: T } },
      }),
      { today: T, graceStart: START },
    );
    expect(first.lastActiveDay).toBe(T);
    expect(first.lastActiveDay).not.toBe(addDays(T, -1));
    expect(first.streak).toBe(6);
    expect(first.data.streakGrace?.graceUsedAt).toBeUndefined();

    const second = mergeProgressPush(
      push({ streak: 1, lastActiveDay: addDays(T, 1) }),
      {
        ...emptyServer,
        streak: first.streak,
        lastActiveDay: first.lastActiveDay,
        extra: { streakGrace: first.data.streakGrace },
      },
      { today: T, graceStart: START },
    );
    expect(second.streak).toBe(6);
    expect(second.data.streakGrace).toEqual({ lastSeenUtcDay: T });
    expect(second.lastActiveDay).toBe(addDays(T, 1));
  });

  it("a real grace chained into the next merge rejects a second claim", () => {
    const first = mergeProgressPush(
      push({ streak: 1, lastActiveDay: T }),
      gracedServer(),
      { today: T, graceStart: START },
    );
    expect(first.streak).toBe(5);
    expect(first.data.streakGrace).toEqual({
      graceUsedAt: T,
      lastSeenUtcDay: T,
    });

    for (const crafted of [addDays(T, -1), addDays(T, 1)]) {
      const again = mergeProgressPush(
        push({ streak: 1, lastActiveDay: crafted }),
        {
          ...emptyServer,
          streak: first.streak,
          lastActiveDay: first.lastActiveDay,
          extra: { streakGrace: first.data.streakGrace },
        },
        { today: T, graceStart: START },
      );
      expect(again.streak).toBe(5);
      expect(again.data.streakGrace?.graceUsedAt).toBe(T);
    }

    const nextGap = addDays(T, 2);
    const later = mergeProgressPush(
      push({ streak: 1, lastActiveDay: nextGap }),
      {
        ...emptyServer,
        streak: first.streak,
        lastActiveDay: first.lastActiveDay,
        extra: { streakGrace: first.data.streakGrace },
      },
      { today: nextGap, graceStart: START },
    );
    expect(isExactlyOneMissedServerDay(T, nextGap)).toBe(true);
    expect(later.streak).toBe(5);
    expect(later.streak).not.toBe(6);
    expect(later.data.streakGrace).toEqual({
      graceUsedAt: T,
      lastSeenUtcDay: nextGap,
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
        extra: { streakGrace: storedGrace },
      },
      { today: TODAY, graceStart: START },
    );
    expect(far.streak).toBe(8);
    expect(far.lastActiveDay).toBe(STORED_DAY);
    expect(far.data.streakGrace).toEqual({ graceUsedAt: "2026-10-18" });

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
      gracedServer(),
      { today: TODAY, graceStart: START },
    );
    expect(first.streak).toBe(5);
    expect(first.lastActiveDay).toBe(TODAY);
    expect(first.data.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: TODAY,
    });

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
    expect(second.data.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: TODAY,
    });

    const stored = { streak: second.streak, lastActiveDay: TODAY };
    const incoming = { streak: 1, lastActiveDay: TODAY };
    const mergedStreak = streakFromNewerLastActiveDay(stored, incoming);
    expect(mergedStreak).toBe(5);

    const recency = applyOneTimeStreakGrace(
      graceInput({
        storedStreak: stored.streak,
        incomingStreak: incoming.streak,
        mergedStreak,
        storedGrace: second.data.streakGrace,
        today: TODAY,
      }),
    );
    expect(recency.streak).toBe(5);
    expect(recency.streakGrace?.graceUsedAt).toBe(TODAY);
  });

  it("does not grace outside the window on the server merge", () => {
    const outside = addDays(START, STREAK_GRACE_WINDOW.lengthDays);
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: outside }),
      gracedServer({
        lastActiveDay: addDays(outside, -2),
        extra: { streakGrace: { lastSeenUtcDay: addDays(outside, -2) } },
      }),
      { today: outside, graceStart: START },
    );
    expect(merged.data.streakGrace).toEqual({ lastSeenUtcDay: outside });
    expect(merged.streak).toBe(4);
    expect(merged.streak).not.toBe(5);
  });

  it("does not grace a two-day gap on the server merge", () => {
    const today = addDays(STORED_DAY, 3);
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: today }),
      gracedServer({
        extra: { streakGrace: { lastSeenUtcDay: STORED_DAY } },
      }),
      { today, graceStart: START },
    );
    expect(merged.data.streakGrace?.graceUsedAt).toBeUndefined();
    expect(merged.streak).toBe(4);
    expect(merged.streak).not.toBe(5);
  });

  it("a second missed day is not graced by the server merge", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      streak: 5,
      lastActiveDay: TODAY,
      extra: {
        streakGrace: { graceUsedAt: TODAY, lastSeenUtcDay: TODAY },
      },
    };
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: "2026-10-24" }),
      server,
      { today: "2026-10-24", graceStart: START },
    );
    expect(merged.data.streakGrace).toEqual({
      graceUsedAt: TODAY,
      lastSeenUtcDay: "2026-10-24",
    });
    expect(merged.streak).toBe(server.streak);
    expect(merged.streak).not.toBe(server.streak + 1);
  });

  it("Test A: an old client that omits streakGrace does not wipe a stored flag", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      xp: 20,
      streak: 4,
      lastActiveDay: TODAY,
      extra: {
        streakGrace: legacyUsed("2026-10-18", "2026-10-19"),
        weaknesses: { fork: 2 },
      },
    };
    const body = push({ xp: 25, streak: 4, lastActiveDay: TODAY });
    expect(body).not.toHaveProperty("streakGrace");

    const merged = mergeProgressPush(body, server, { today: TODAY, graceStart: START });
    expect(merged.data.streakGrace).toEqual({
      graceUsedAt: "2026-10-18",
      lastSeenUtcDay: TODAY,
    });
    expect(merged.data.weaknesses).toEqual({ fork: 2 });
    expect(mergeExtraData(server.extra, {})).toMatchObject({
      streakGrace: { graceUsedAt: "2026-10-18", lastSeenUtcDay: "2026-10-19" },
      weaknesses: { fork: 2 },
    });
  });

  it("Test B: a client grace value is ignored and the server value stays", () => {
    const canonical = { graceUsedAt: "2026-10-18", lastSeenUtcDay: "2026-10-19" };
    const prev = {
      streakGrace: legacyUsed("2026-10-18", "2026-10-19"),
      unlockedAchievements: ["a"],
    };
    expect(mergeExtraData(prev, { streakGrace: null } as never).streakGrace).toEqual(
      canonical,
    );
    expect(
      mergeExtraData(prev, { streakGrace: { used: false } } as never).streakGrace,
    ).toEqual(canonical);
    expect(
      mergeExtraData(prev, {
        streakGrace: { graceUsedAt: "1999-01-01", lastSeenUtcDay: "2099-01-01" },
      }).streakGrace,
    ).toEqual(canonical);
    expect(
      mergeExtraData(prev, { streakGrace: { usedOn: "1999-01-01" } as never })
        .streakGrace,
    ).toEqual(canonical);
    expect(
      mergeExtraData(prev, { unlockedAchievements: ["b"] }).unlockedAchievements,
    ).toEqual(["a", "b"]);
    expect(
      mergeExtraData({}, { streakGrace: { usedOn: "1999-01-01" } as never })
        .streakGrace,
    ).toBeUndefined();

    const invented = mergeProgressPush(
      push({
        streak: 4,
        lastActiveDay: TODAY,
        streakGrace: { graceUsedAt: "1999-01-01", lastSeenUtcDay: "2099-01-01" },
      }),
      { ...emptyServer, streak: 4, lastActiveDay: TODAY },
      { today: TODAY, graceStart: START },
    );
    expect(invented.data.streakGrace).toEqual({ lastSeenUtcDay: TODAY });
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
        streakGrace: { usedOn: "1999-01-01", graceUsedAt: null, lastSeenUtcDay: null },
      }),
      server,
      { today: TODAY, graceStart: START },
    );
    expect(merged.data.streakGrace).toEqual({
      graceUsedAt: "2026-10-18",
      lastSeenUtcDay: TODAY,
    });
    expect(merged.streak).toBe(4);
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
    expect(merged.data.streakGrace).toEqual({
      graceUsedAt: "2026-10-18",
      lastSeenUtcDay: TODAY,
    });
  });

  it("uses STREAK_GRACE_START from the environment during merge", () => {
    const previous = process.env.STREAK_GRACE_START;
    process.env.STREAK_GRACE_START = START;
    try {
      const merged = mergeProgressPush(
        push({ streak: 1, lastActiveDay: TODAY }),
        gracedServer({ streak: 3 }),
        { today: TODAY },
      );
      expect(merged.streak).toBe(4);
      expect(merged.data.streakGrace).toEqual({
        graceUsedAt: TODAY,
        lastSeenUtcDay: TODAY,
      });
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
      streakGrace: {
        usedOn: "1999-01-01",
        graceUsedAt: "1999-01-01",
        lastSeenUtcDay: "2099-01-01",
        used: false,
      },
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data).not.toHaveProperty("streakGrace");
  });

  it("stores an older in-range client day without treating it as the grace gap", () => {
    const older = addDays(T, -5);
    const merged = mergeProgressPush(
      push({ streak: 1, lastActiveDay: older }),
      { ...emptyServer, streak: 4, lastActiveDay: null },
      { today: T, graceStart: START },
    );
    expect(merged.lastActiveDay).toBe(older);
    expect(merged.streak).toBe(4);
    expect(merged.data.streakGrace).toEqual({ lastSeenUtcDay: T });
  });
});

describe("readStoredStreakGrace", () => {
  it("accepts a server-written calendar day and migrates usedOn", () => {
    expect(readStoredStreakGrace(undefined)).toBeUndefined();
    expect(readStoredStreakGrace(null)).toBeUndefined();
    expect(readStoredStreakGrace("2026-10-22")).toBeUndefined();
    expect(readStoredStreakGrace({ used: false })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: "" })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: 20261022 })).toBeUndefined();
    expect(readStoredStreakGrace({ usedOn: "2026-02-30" })).toBeUndefined();
    expect(readStoredStreakGrace({ graceUsedAt: "2026-02-30", usedOn: TODAY })).toEqual(
      {
        graceUsedAt: TODAY,
      },
    );
    expect(readStoredStreakGrace({ usedOn: TODAY })).toEqual({ graceUsedAt: TODAY });
    expect(readStoredStreakGrace({ graceUsedAt: TODAY })).toEqual({
      graceUsedAt: TODAY,
    });
    expect(
      readStoredStreakGrace({
        graceUsedAt: "2026-10-18",
        usedOn: TODAY,
        lastSeenUtcDay: STORED_DAY,
      }),
    ).toEqual({ graceUsedAt: "2026-10-18", lastSeenUtcDay: STORED_DAY });
    expect(readStoredStreakGrace({ lastSeenUtcDay: "2026-02-30" })).toBeUndefined();
    expect(readStoredStreakGrace({ lastSeenUtcDay: TODAY })).toEqual({
      lastSeenUtcDay: TODAY,
    });
  });
});
