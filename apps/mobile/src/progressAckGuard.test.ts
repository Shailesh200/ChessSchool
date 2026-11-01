import { afterEach, describe, expect, it, vi } from "vitest";
import { adoptAckUnlessEdited } from "./progressAckGuard";

const ack = {
  streak: 4,
  lastActiveDay: "2026-10-29",
  rating: 1400,
  ratingUpdatedAt: 5_000,
  dailyGoalXp: 80,
  goalUpdatedAt: 6_000,
  homeworkStreak: 3,
  homeworkLastDay: "2026-10-29",
};

describe("mobile ack guard (unit)", () => {
  const pushed = {
    streak: 1,
    lastActiveDay: "2026-10-28",
    rating: 1500,
    ratingUpdatedAt: 1_000,
    dailyGoalXp: 50,
    goalUpdatedAt: 2_000,
    homeworkStreak: 1,
    homeworkLastDay: "2026-10-28",
  };

  it("adopts every group when nothing changed during the push", () => {
    expect(adoptAckUnlessEdited({ ...pushed }, pushed, ack)).toEqual(ack);
  });

  it("leaves a group the user edited in flight and adopts the rest", () => {
    const current = {
      ...pushed,
      rating: 1530,
      ratingUpdatedAt: 9_000,
      dailyGoalXp: 30,
    };
    const result = adoptAckUnlessEdited(current, pushed, ack);
    expect(result.rating).toBe(1530);
    expect(result.ratingUpdatedAt).toBe(9_000);
    expect(result.dailyGoalXp).toBe(30);
    expect(result.goalUpdatedAt).toBe(2_000);
    expect(result.streak).toBe(4);
    expect(result.homeworkStreak).toBe(3);
  });

  it("keeps the local homework pair when the reply has no homework day", () => {
    const { homeworkLastDay: _d, homeworkStreak: _s, ...noHomework } = ack;
    const result = adoptAckUnlessEdited({ ...pushed }, pushed, noHomework);
    expect(result.homeworkStreak).toBe(1);
    expect(result.homeworkLastDay).toBe("2026-10-28");
    expect(result.streak).toBe(4);
  });

  it("leaves a group when only its stamp changed in flight", () => {
    for (const [key, valueKey] of [
      ["ratingUpdatedAt", "rating"],
      ["goalUpdatedAt", "dailyGoalXp"],
    ] as const) {
      const current = { ...pushed, [key]: 9_000 };
      const result = adoptAckUnlessEdited(current, pushed, ack);
      expect(result[key], key).toBe(9_000);
      expect(result[valueKey], valueKey).toBe(pushed[valueKey]);
      // The other groups still adopt the reply.
      expect(result.streak, key).toBe(4);
    }
  });

  it("leaves the streak group when only its day changed in flight", () => {
    const current = { ...pushed, lastActiveDay: "2026-10-29" };
    const result = adoptAckUnlessEdited(current, pushed, ack);
    expect(result.streak).toBe(1);
    expect(result.lastActiveDay).toBe("2026-10-29");
    expect(result.rating).toBe(1400);
  });

  it("leaves the homework pair when its day or its streak changed in flight", () => {
    const dayEdited = adoptAckUnlessEdited(
      { ...pushed, homeworkLastDay: "2026-10-29" },
      pushed,
      ack,
    );
    expect(dayEdited.homeworkStreak).toBe(1);
    expect(dayEdited.homeworkLastDay).toBe("2026-10-29");
    expect(dayEdited.streak).toBe(4);
    const streakEdited = adoptAckUnlessEdited(
      { ...pushed, homeworkStreak: 2 },
      pushed,
      ack,
    );
    expect(streakEdited.homeworkStreak).toBe(2);
    expect(streakEdited.homeworkLastDay).toBe("2026-10-28");
  });

  it("does not adopt a homework streak that arrives without its day", () => {
    const { homeworkLastDay: _d, ...streakOnly } = ack;
    const result = adoptAckUnlessEdited({ ...pushed }, pushed, streakOnly);
    expect(result.homeworkStreak).toBe(1);
    expect(result.homeworkLastDay).toBe("2026-10-28");
    expect(result.streak).toBe(4);
  });

  it("ignores a legacy reply", () => {
    const current = { ...pushed };
    expect(adoptAckUnlessEdited(current, pushed, { ok: true, count: 1 })).toBe(current);
  });
});

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});
const apiMock = vi.hoisted(() => vi.fn());
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("react", () => ({
  useEffect: () => undefined,
  useSyncExternalStore: () => null,
}));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("./api", () => ({
  api: apiMock,
  getToken: async () => "token",
  ApiError: class ApiError extends Error {
    status = 0;
  },
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe("mutateProgress keeps an edit made while the push is in flight", () => {
  it("does not overwrite the edited rating with the reply", async () => {
    const { mutateProgress, progressStore } = await import("./progressStore");
    const start = { xp: 10, rating: 1500, ratingUpdatedAt: 1_000, streak: 1 };
    progressStore.set({ ...start });

    let finishPush: (reply: unknown) => void = () => undefined;
    apiMock.mockImplementation(
      () => new Promise((resolve) => (finishPush = resolve as typeof finishPush)),
    );
    const writing = mutateProgress((snap) => ({ ...snap, xp: 20 }));
    await vi.waitFor(() => expect(apiMock).toHaveBeenCalledTimes(1));

    // The user changes the rating while the push is on the wire.
    const pushedBody = (apiMock.mock.calls[0]![1] as { body: Record<string, unknown> })
      .body;
    progressStore.set({ ...pushedBody, rating: 1530, ratingUpdatedAt: 9_000 });
    finishPush({ rating: 1400, ratingUpdatedAt: 5_000, streak: 4 });
    await writing;

    const after = progressStore.get() as Record<string, unknown>;
    expect(after.rating).toBe(1530);
    expect(after.ratingUpdatedAt).toBe(9_000);
    // A group that was not edited still adopts the reply.
    expect(after.streak).toBe(4);
  });

  it("adopts the reply when nothing changed", async () => {
    const { mutateProgress, progressStore } = await import("./progressStore");
    progressStore.set({ xp: 10, rating: 1500, ratingUpdatedAt: 1_000 });
    apiMock.mockResolvedValue({ rating: 1400, ratingUpdatedAt: 5_000 });
    await mutateProgress((snap) => ({ ...snap, xp: 20 }));
    const after = progressStore.get() as Record<string, unknown>;
    expect(after.rating).toBe(1400);
    expect(after.ratingUpdatedAt).toBe(5_000);
  });
});
