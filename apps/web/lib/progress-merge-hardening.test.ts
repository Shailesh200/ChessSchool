import { beforeEach, describe, expect, it } from "vitest";
import { applyServerProgressAck } from "@/core/sync/applyProgressAck";
import { fullSnapshot } from "@/core/sync/pullProgress";
import { usePlan } from "@/core/store/plan.store";
import { useProgression } from "@/core/store/progression.store";
import { MAX_ACTIVITY_DAYS, MAX_WEAKNESSES } from "@chess-school/progression";
import { progressPushSchema, type ProgressPushBody } from "@/lib/api-schemas";
import {
  mergeProgressPush,
  nextHomeworkStreak,
  progressPushResponseBody,
  type ServerProgressState,
} from "./progress-merge";

const GRACE_OFF = "2099-01-01";

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

/** A server row whose active days are `days`, with the streak those days support. */
function serverWithDays(
  days: string[],
  streak: number,
  tz?: string,
): ServerProgressState {
  return {
    ...emptyServer,
    streak,
    lastActiveDay: days[days.length - 1] ?? null,
    extra: { streakGrace: { activeDays: days }, ...(tz ? { tz } : {}) },
  };
}

function noPlayPush(at: string, server: ServerProgressState) {
  return mergeProgressPush(push({ xp: server.xp }), server, {
    now: new Date(at),
    graceStart: GRACE_OFF,
  });
}

describe("a legacy daily goal through the server merge", () => {
  it("snaps to the nearest allowed goal instead of becoming missing", () => {
    // A newer legacy goal from the client is snapped, so it still wins over the stored 40.
    const fromClient = mergeProgressPush(push({ dailyGoalXp: 47, goalUpdatedAt: 20 }), {
      ...emptyServer,
      dailyGoalXp: 40,
      extra: { dailyGoalXp: 40, goalUpdatedAt: 10 },
    });
    expect(fromClient.dailyGoalXp).toBe(50);
    expect(fromClient.data.dailyGoalXp).toBe(50);
    // A stored legacy goal that the client has not replaced is snapped too.
    const stored = mergeProgressPush(push({ dailyGoalXp: 40, goalUpdatedAt: 5 }), {
      ...emptyServer,
      dailyGoalXp: 45,
      extra: { dailyGoalXp: 45, goalUpdatedAt: 10 },
    });
    expect(stored.dailyGoalXp).toBe(50);
  });
});

describe("a writer stamp without its value, through the server merge", () => {
  it("a push that carries stamps but no rating or goal keeps the stored ones", () => {
    const merged = mergeProgressPush(
      push({ ratingUpdatedAt: 9_000, goalUpdatedAt: 9_000 }),
      {
        ...emptyServer,
        dailyGoalXp: 30,
        extra: {
          rating: 1500,
          ratingUpdatedAt: 100,
          dailyGoalXp: 30,
          goalUpdatedAt: 100,
        },
      },
    );
    expect(merged.data.rating).toBe(1500);
    expect(merged.dailyGoalXp).toBe(30);
    expect(merged.data.ratingUpdatedAt).toBe(100);
    expect(merged.data.goalUpdatedAt).toBe(100);
  });
});

describe("streak counts from the user's local day", () => {
  const LA = "America/Los_Angeles";

  it("LA: a push with no play at 8 PM Oct 29 local keeps the streak", () => {
    // 20:00 PDT on Oct 29 is 03:00Z on Oct 30. The UTC day is already Oct 30.
    const server = serverWithDays(["2026-10-27", "2026-10-28"], 2, LA);
    const merged = noPlayPush("2026-10-30T03:00:00.000Z", server);
    expect(merged.streak).toBe(2);
  });

  it("LA: no play on Oct 29 local, then a push at 00:30 Oct 30 local gives 0", () => {
    // 00:30 PDT on Oct 30 is 07:30Z on Oct 30.
    const server = serverWithDays(["2026-10-27", "2026-10-28"], 2, LA);
    const merged = noPlayPush("2026-10-30T07:30:00.000Z", server);
    expect(merged.streak).toBe(0);
  });

  it("IST and UTC give the same results as before", () => {
    const ist = serverWithDays(["2026-10-27", "2026-10-28"], 2, "Asia/Kolkata");
    expect(noPlayPush("2026-10-29T04:30:00.000Z", ist).streak).toBe(2);
    const istNext = serverWithDays(["2026-10-28", "2026-10-29"], 2, "Asia/Kolkata");
    expect(noPlayPush("2026-10-29T20:00:00.000Z", istNext).streak).toBe(2);
    const utc = serverWithDays(["2026-10-27", "2026-10-28"], 2, "UTC");
    expect(noPlayPush("2026-10-29T12:00:00.000Z", utc).streak).toBe(2);
    expect(noPlayPush("2026-10-30T12:00:00.000Z", utc).streak).toBe(0);
  });

  it("an unknown time zone with a push that has no play never lowers the streak", () => {
    const noZone = serverWithDays(["2026-10-27", "2026-10-28"], 2);
    expect(noPlayPush("2026-10-30T03:00:00.000Z", noZone).streak).toBe(2);
    const badStored = serverWithDays(["2026-10-27", "2026-10-28"], 2, "Not/AZone");
    expect(noPlayPush("2026-10-30T03:00:00.000Z", badStored).streak).toBe(2);
    const badSent = mergeProgressPush(push({ tz: "Not/AZone" }), noZone, {
      now: new Date("2026-10-30T03:00:00.000Z"),
      graceStart: GRACE_OFF,
    });
    expect(badSent.streak).toBe(2);
  });

  it("a streak lapsed beyond UTC-2 with no time zone is not kept alive", () => {
    // Last active Oct 28. Six days later no zone can still hold the streak.
    const noZone = serverWithDays(["2026-10-27", "2026-10-28"], 2);
    expect(noPlayPush("2026-11-03T12:00:00.000Z", noZone).streak).toBe(0);
    // UTC-2 is the last day it may still show: Oct 30 keeps, Oct 31 lets it go.
    expect(noPlayPush("2026-10-30T12:00:00.000Z", noZone).streak).toBe(2);
    expect(noPlayPush("2026-10-31T12:00:00.000Z", noZone).streak).toBe(0);
    const badStored = serverWithDays(["2026-10-27", "2026-10-28"], 2, "Not/AZone");
    expect(noPlayPush("2026-11-03T12:00:00.000Z", badStored).streak).toBe(0);
  });

  it("a time zone alias is stored in its canonical form", () => {
    const server = serverWithDays(["2026-10-28"], 1);
    const merged = mergeProgressPush(push({ tz: "US/Pacific" }), server, {
      now: new Date("2026-10-29T12:00:00.000Z"),
      graceStart: GRACE_OFF,
    });
    expect(merged.data.tz).toBe(LA);
    const stored = noPlayPush(
      "2026-10-29T12:00:00.000Z",
      serverWithDays(["2026-10-28"], 1, "US/Pacific"),
    );
    expect(stored.data.tz).toBe(LA);
  });

  it("a stored time zone that no longer resolves is dropped", () => {
    const merged = noPlayPush(
      "2026-10-29T12:00:00.000Z",
      serverWithDays(["2026-10-28"], 1, "Not/AZone"),
    );
    expect(merged.data.tz).toBeUndefined();
    const valid = noPlayPush(
      "2026-10-29T12:00:00.000Z",
      serverWithDays(["2026-10-28"], 1, LA),
    );
    expect(valid.data.tz).toBe(LA);
  });
});

describe("homework day window", () => {
  const today = "2026-10-22";

  it("rejects a day older than UTC-1 and accepts the inclusive UTC+1 edge", () => {
    expect(
      nextHomeworkStreak({
        storedStreak: 0,
        storedDay: null,
        incomingDay: "2026-10-20",
        utcToday: today,
      }),
    ).toEqual({ streak: 0, day: null });
    expect(
      nextHomeworkStreak({
        storedStreak: 0,
        storedDay: null,
        incomingDay: "2026-10-21",
        utcToday: today,
      }),
    ).toEqual({ streak: 1, day: "2026-10-21" });
    expect(
      nextHomeworkStreak({
        storedStreak: 0,
        storedDay: null,
        incomingDay: "2026-10-23",
        utcToday: today,
      }),
    ).toEqual({ streak: 1, day: "2026-10-23" });
    expect(
      nextHomeworkStreak({
        storedStreak: 0,
        storedDay: null,
        incomingDay: "2026-10-24",
        utcToday: today,
      }),
    ).toEqual({ streak: 0, day: null });
  });

  it("treats a stored day after UTC+1 as unset", () => {
    expect(
      nextHomeworkStreak({
        storedStreak: 7,
        storedDay: "2026-10-30",
        incomingDay: null,
        utcToday: today,
      }),
    ).toEqual({ streak: 0, day: null });
    expect(
      nextHomeworkStreak({
        storedStreak: 7,
        storedDay: "2026-10-30",
        incomingDay: today,
        utcToday: today,
      }),
    ).toEqual({ streak: 1, day: today });
    // The stored UTC+1 day itself is real.
    expect(
      nextHomeworkStreak({
        storedStreak: 7,
        storedDay: "2026-10-23",
        incomingDay: null,
        utcToday: today,
      }),
    ).toEqual({ streak: 7, day: "2026-10-23" });
  });

  it("a rejected claim with nothing stored leaves the homework fields out", () => {
    const merged = mergeProgressPush(
      push({ homeworkStreak: 5, homeworkLastDay: "2026-10-19" }),
      emptyServer,
      { today, graceStart: GRACE_OFF },
    );
    const reply = progressPushResponseBody(1, merged);
    expect(reply).not.toHaveProperty("homeworkStreak");
    expect(reply).not.toHaveProperty("homeworkLastDay");
    // With a day stored the pair is sent.
    const stored = mergeProgressPush(push({ homeworkLastDay: today }), emptyServer, {
      today,
      graceStart: GRACE_OFF,
    });
    expect(progressPushResponseBody(1, stored)).toMatchObject({
      homeworkStreak: 1,
      homeworkLastDay: today,
    });
  });
});

describe("the client keeps its homework streak when the reply has none", () => {
  beforeEach(() => {
    useProgression.getState().reset();
    usePlan.setState({ homeworkStreak: 4, homeworkLastDay: "2026-10-20" });
  });

  it("a reply with no homework fields leaves the local pair alone", () => {
    const merged = mergeProgressPush(
      push({ homeworkStreak: 4, homeworkLastDay: "2026-10-01" }),
      emptyServer,
      { today: "2026-10-22", graceStart: GRACE_OFF },
    );
    applyServerProgressAck(progressPushResponseBody(1, merged));
    expect(usePlan.getState().homeworkStreak).toBe(4);
    expect(usePlan.getState().homeworkLastDay).toBe("2026-10-20");
  });
});

describe("ack adoption after a newer local edit", () => {
  const body = {
    ok: true,
    count: 1,
    streak: 3,
    lastActiveDay: "2026-10-22",
    rating: 1400,
    ratingUpdatedAt: 5_000,
    dailyGoalXp: 30,
    goalUpdatedAt: 5_000,
    homeworkStreak: 2,
    homeworkLastDay: "2026-10-22",
  };
  const pushed = {
    streak: 1,
    lastActiveDay: "2026-10-20",
    rating: 1500,
    ratingUpdatedAt: 10,
    dailyGoalXp: 80,
    goalUpdatedAt: 10,
    homeworkStreak: 4,
    homeworkLastDay: "2026-10-20",
  };

  beforeEach(() => {
    useProgression.getState().reset();
    usePlan.setState({ homeworkStreak: 0, homeworkLastDay: null });
    useProgression.setState({ ...pushed });
    usePlan.setState({ homeworkStreak: 4, homeworkLastDay: "2026-10-20" });
  });

  it("adopts every group when nothing changed since the push", () => {
    applyServerProgressAck(body, pushed);
    expect(useProgression.getState().rating).toBe(1400);
    expect(useProgression.getState().dailyGoalXp).toBe(30);
    expect(useProgression.getState().streak).toBe(3);
    expect(usePlan.getState().homeworkStreak).toBe(2);
  });

  it("keeps a rating, goal, streak or homework edit made while the push was in flight", () => {
    useProgression.setState({
      rating: 1650,
      ratingUpdatedAt: 20,
      dailyGoalXp: 100,
      goalUpdatedAt: 20,
      streak: 2,
      lastActiveDay: "2026-10-21",
    });
    usePlan.setState({ homeworkStreak: 5, homeworkLastDay: "2026-10-21" });
    applyServerProgressAck(body, pushed);
    const progress = useProgression.getState();
    expect(progress.rating).toBe(1650);
    expect(progress.ratingUpdatedAt).toBe(20);
    expect(progress.dailyGoalXp).toBe(100);
    expect(progress.goalUpdatedAt).toBe(20);
    expect(progress.streak).toBe(2);
    expect(progress.lastActiveDay).toBe("2026-10-21");
    expect(usePlan.getState().homeworkStreak).toBe(5);
    expect(usePlan.getState().homeworkLastDay).toBe("2026-10-21");
  });

  it("adopts the groups that did not change, one by one", () => {
    useProgression.setState({ rating: 1650, ratingUpdatedAt: 20 });
    applyServerProgressAck(body, pushed);
    expect(useProgression.getState().rating).toBe(1650);
    expect(useProgression.getState().dailyGoalXp).toBe(30);
    expect(useProgression.getState().streak).toBe(3);
  });
});

describe("a large map still syncs", () => {
  const keys = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [`k${String(i).padStart(6, "0")}`, 1]),
    );
  /** Real `YYYY-MM-DD` keys: the schema drops any other activityDays key. */
  const dayKeys = (count: number) =>
    Object.fromEntries(
      Array.from({ length: count }, (_, i) => [
        new Date(Date.UTC(2000, 0, 1 + i)).toISOString().slice(0, 10),
        1,
      ]),
    );
  const base = {
    xp: 0,
    streak: 0,
    lastActiveDay: null,
    graduatedClasses: [],
    lessons: {},
  };

  it("the schema truncates an over-cap push instead of rejecting it", () => {
    const parsed = progressPushSchema.safeParse({
      ...base,
      activityDays: dayKeys(MAX_ACTIVITY_DAYS + 500),
      weaknesses: keys(MAX_WEAKNESSES + 100),
    });
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(Object.keys(parsed.data.activityDays ?? {})).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(Object.keys(parsed.data.weaknesses ?? {})).toHaveLength(MAX_WEAKNESSES);
  });

  it("a full stored map plus a push with new keys is trimmed after the union", () => {
    const server: ServerProgressState = {
      ...emptyServer,
      extra: {
        activityDays: dayKeys(MAX_ACTIVITY_DAYS),
        weaknesses: keys(MAX_WEAKNESSES),
      },
    };
    const merged = mergeProgressPush(
      push({
        activityDays: { z999999: 5, z999998: 5 },
        weaknesses: { hot: 50 },
      }),
      server,
    );
    expect(Object.keys(merged.data.activityDays ?? {})).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(merged.data.activityDays).toHaveProperty("z999999");
    expect(Object.keys(merged.data.weaknesses ?? {})).toHaveLength(MAX_WEAKNESSES);
    expect(merged.data.weaknesses?.hot).toBe(50);
  });

  it("the client trims before sending", () => {
    useProgression.setState({
      activityDays: dayKeys(MAX_ACTIVITY_DAYS + 300),
      weaknesses: keys(MAX_WEAKNESSES + 50),
    });
    const snap = fullSnapshot();
    expect(Object.keys(snap.activityDays ?? {})).toHaveLength(MAX_ACTIVITY_DAYS);
    expect(Object.keys(snap.weaknesses ?? {})).toHaveLength(MAX_WEAKNESSES);
    useProgression.getState().reset();
  });
});
