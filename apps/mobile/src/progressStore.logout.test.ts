import { beforeEach, describe, expect, it, vi } from "vitest";

// A push reply must not write the old user's snapshot back into the cache once it
// was cleared (logout, account deletion) while the push was in flight.

type Deferred = { promise: Promise<unknown>; resolve: (v: unknown) => void };
function deferred(): Deferred {
  let resolve!: (v: unknown) => void;
  const promise = new Promise<unknown>((r) => (resolve = r));
  return { promise, resolve };
}

const secure = vi.hoisted(() => ({
  setItemAsync: vi.fn(async () => undefined),
  getItemAsync: vi.fn(async () => null),
  deleteItemAsync: vi.fn(async () => undefined),
}));
const tokenBox = vi.hoisted(() => ({ token: "token" as string | null }));
const settings = vi.hoisted(() => ({
  hydrateSettings: vi.fn(),
  loadSettingsFromAccount: vi.fn(),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => secure);
vi.mock("./settings", () => settings);
vi.mock("./api", () => {
  class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }
  return { ApiError, api: vi.fn(), getToken: vi.fn(async () => tokenBox.token) };
});

import { api } from "./api";
import {
  fetchProgress,
  getProgressWriteError,
  mutateProgress,
  progressStore,
  syncProgressAfterAuth,
} from "./progressStore";

const apiMock = vi.mocked(api);
const oldUser = {
  user: { id: "old-user" },
  rating: 1500,
  ratingUpdatedAt: 1_000,
  streak: 2,
  lastActiveDay: "2026-10-28",
  recentGames: [{ id: "g1" }],
};
const ack = { ok: true, count: 1, rating: 1600, ratingUpdatedAt: 5_000 };
const tick = () => new Promise((r) => setTimeout(r, 0));
async function until(cond: () => boolean) {
  for (let i = 0; i < 200 && !cond(); i++) await tick();
}
const posts = () =>
  apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === "POST");

beforeEach(() => {
  apiMock.mockReset();
  secure.setItemAsync.mockClear();
  settings.hydrateSettings.mockClear();
  tokenBox.token = "token";
  progressStore.clear();
});

describe("mobile progress push ack vs logout", () => {
  it("adopts the reply when nothing was cleared (control)", async () => {
    progressStore.set({ ...oldUser });
    apiMock.mockResolvedValueOnce(ack);
    await mutateProgress((s) => ({ ...s, rating: 1600 }));
    expect((progressStore.get() as { rating: number }).rating).toBe(1600);
    expect((progressStore.get() as { user: unknown }).user).toEqual({ id: "old-user" });
  });

  it("drops the reply and the games cache write when clear() ran during the push", async () => {
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const done = mutateProgress((s) => ({ ...s, rating: 1600 }));
    await tick();
    expect(posts()).toHaveLength(1);

    progressStore.clear(); // logout while the POST is in flight
    flight.resolve(ack);
    await done;

    expect(progressStore.get()).toBeNull();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });

  it("drops the merge reply of syncProgressAfterAuth when clear() ran during the push", async () => {
    progressStore.set({ xp: 40, lessons: {}, user: { id: "guest" } });
    const flight = deferred();
    apiMock.mockImplementation(((path: string, opts?: { method?: string }) =>
      opts?.method === "POST"
        ? flight.promise
        : Promise.resolve({ xp: 0, lessons: {}, user: { id: "u" } })) as never);
    const done = syncProgressAfterAuth();
    await until(() => posts().length === 1);
    expect(posts()).toHaveLength(1);

    progressStore.clear();
    flight.resolve({ ...ack, xp: 40 });
    await done;

    expect(progressStore.get()).toBeNull();
  });

  it("does not write the old user's snapshot as guest progress when the push fails after clear()", async () => {
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const done = mutateProgress((s) => ({ ...s, rating: 1600 }));
    await until(() => posts().length === 1);

    progressStore.clear();
    const { ApiError } = await import("./api");
    flight.resolve(Promise.reject(new ApiError(401, "unauthorized")));
    await done.catch(() => undefined);

    expect(progressStore.get()).toBeNull();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });

  it("keeps a field edited during the flight and sends it with the next push", async () => {
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const first = mutateProgress((s) => ({ ...s, rating: 1600 }));
    await tick();

    // the player finishes a game while the first push is in flight
    progressStore.set({
      ...(progressStore.get() as object),
      rating: 1700,
      ratingUpdatedAt: 9_000,
    });
    flight.resolve(ack);
    await first;

    const live = progressStore.get() as { rating: number; ratingUpdatedAt: number };
    expect(live.rating).toBe(1700); // the stale reply (1600) did not overwrite it
    expect(live.ratingUpdatedAt).toBe(9_000);

    apiMock.mockResolvedValueOnce({ ok: true, count: 1 });
    await mutateProgress((s) => s);
    const body = (posts()[1][1] as { body: { rating: number } }).body;
    expect(body.rating).toBe(1700); // goes out on the next push
  });
});

// The same race for the other writers: a GET that resolves after logout, an edit
// queued before logout, and the failure and error-flag paths of a push.
describe("mobile progress GET and queued edits vs logout", () => {
  const userA = {
    user: { id: "A" },
    xp: 500,
    recentGames: [{ id: "gA" }],
    settings: { s: 1 },
  };
  const userB = { user: { id: "B" }, xp: 7, lessons: {} };

  it("a GET that resolves after clear() writes nothing of the old user", async () => {
    const get = deferred();
    apiMock.mockReturnValueOnce(get.promise as never);
    const pending = fetchProgress(true);
    await until(() => apiMock.mock.calls.length === 1);

    tokenBox.token = null;
    progressStore.clear(); // logout while the GET is in flight
    get.resolve({ ...userA });
    const got = await pending;

    expect(got).toBeNull();
    expect(progressStore.get()).toBeNull();
    expect(secure.setItemAsync).not.toHaveBeenCalled(); // games cache
    expect(settings.hydrateSettings).not.toHaveBeenCalled();
  });

  it("clear() drops the old user's in-flight GET, so the next user gets their own", async () => {
    const getA = deferred();
    const getB = deferred();
    apiMock
      .mockReturnValueOnce(getA.promise as never)
      .mockReturnValueOnce(getB.promise as never);
    void fetchProgress(true);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.clear();
    tokenBox.token = "tokB";
    const pendingB = fetchProgress(false);
    await until(() => apiMock.mock.calls.length === 2); // a new GET, not A's promise

    getA.resolve({ ...userA }); // A's late reply lands first
    getB.resolve({ ...userB });
    const got = (await pendingB) as { user: { id: string } };

    expect(got.user.id).toBe("B");
    expect((progressStore.get() as { user: { id: string } }).user.id).toBe("B");
  });

  it("an old GET that fails late does not drop the next user's in-flight GET", async () => {
    const getA = deferred();
    const getB = deferred();
    apiMock
      .mockReturnValueOnce(getA.promise as never)
      .mockReturnValueOnce(getB.promise as never);
    const pendingA = fetchProgress(true).catch(() => undefined);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.clear();
    tokenBox.token = "tokB";
    const pendingB = fetchProgress(false);
    await until(() => apiMock.mock.calls.length === 2);

    const { ApiError } = await import("./api");
    getA.resolve(Promise.reject(new ApiError(500, "boom")));
    await pendingA;
    void fetchProgress(false); // shares B's GET: it must still be registered
    await tick();
    expect(apiMock.mock.calls.length).toBe(2);

    getB.resolve({ ...userB });
    await pendingB;
  });

  it("an edit queued as the old user does not run after clear()", async () => {
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const first = mutateProgress((s) => ({ ...s, xp: 600 }));
    await until(() => posts().length === 1);
    const queuedFn = vi.fn((s: Record<string, unknown>) => ({
      ...s,
      xp: 700,
      recentGames: [{ id: "gA-queued" }],
    }));
    const queued = mutateProgress(queuedFn); // queued behind the slow push

    progressStore.clear(); // logout
    tokenBox.token = "tokB";
    apiMock.mockResolvedValueOnce({ ...userB }); // B's first read
    await syncProgressAfterAuth();
    apiMock.mockResolvedValue({ ok: true, count: 1 });
    flight.resolve({ ok: true, count: 1 });
    await first;
    await queued;

    expect(queuedFn).not.toHaveBeenCalled();
    expect(JSON.stringify(posts())).not.toContain("gA-queued");
    expect((progressStore.get() as { user: { id: string } }).user.id).toBe("B");
  });

  it("an edit queued as the old user does not land in guest storage after logout", async () => {
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const first = mutateProgress((s) => ({ ...s, xp: 600 }));
    await until(() => posts().length === 1);
    const queued = mutateProgress((s) => ({
      ...s,
      recentGames: [{ id: "gA-queued" }],
    }));

    progressStore.clear();
    tokenBox.token = null;
    flight.resolve({ ok: true, count: 1 });
    await first;
    await queued;

    expect(progressStore.get()).toBeNull();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });

  it("an edit queued after clear() still runs (control)", async () => {
    progressStore.clear();
    tokenBox.token = null;
    await mutateProgress((s) => ({ ...s, xp: 5 }));
    expect((progressStore.get() as { xp: number }).xp).toBe(5);
    expect(secure.setItemAsync).toHaveBeenCalled(); // guest snapshot
  });

  it("a merge push that fails after clear() does not write the old snapshot or an error", async () => {
    // an earlier failure left no flag behind
    progressStore.set({ ...oldUser });
    apiMock.mockResolvedValueOnce(ack);
    await mutateProgress((s) => s);
    expect(getProgressWriteError()).toBeNull();

    progressStore.set({ xp: 40, lessons: {}, user: { id: "guest" } });
    const flight = deferred();
    apiMock.mockImplementation(((path: string, opts?: { method?: string }) =>
      opts?.method === "POST"
        ? flight.promise
        : Promise.resolve({ xp: 0, lessons: {}, user: { id: "u" } })) as never);
    const done = syncProgressAfterAuth();
    await until(() => posts().length === 1);

    progressStore.clear();
    const { ApiError } = await import("./api");
    flight.resolve(Promise.reject(new ApiError(500, "boom")));
    await done;

    expect(progressStore.get()).toBeNull();
    expect(getProgressWriteError()).toBeNull();
  });

  it("a stale push reply or failure after clear() clears an earlier error flag", async () => {
    progressStore.set({ ...oldUser });
    apiMock.mockRejectedValueOnce(new Error("offline"));
    await mutateProgress((s) => s).catch(() => undefined);
    expect(getProgressWriteError()).toBe("offline");

    // success after clear
    const ok = deferred();
    apiMock.mockReturnValueOnce(ok.promise as never);
    const a = mutateProgress((s) => s);
    await until(() => posts().length === 2);
    progressStore.clear();
    ok.resolve(ack);
    await a;
    expect(getProgressWriteError()).toBeNull();

    // failure after clear
    progressStore.set({ ...oldUser });
    apiMock.mockRejectedValueOnce(new Error("offline"));
    await mutateProgress((s) => s).catch(() => undefined);
    expect(getProgressWriteError()).toBe("offline");
    const bad = deferred();
    apiMock.mockReturnValueOnce(bad.promise as never);
    const b = mutateProgress((s) => s);
    await until(() => posts().length === 4);
    progressStore.clear();
    bad.resolve(Promise.reject(new Error("offline")));
    await b;
    expect(getProgressWriteError()).toBeNull();
  });
});

// A session-expiry 401 is not a logout: it keeps the last edit as guest progress and
// does not start a new generation. Only an explicit logout (clear()) or a sign-in as a
// different user than the last one does.
describe("mobile progress after a session-expiry 401", () => {
  const userB = { user: { id: "B" }, xp: 7, rating: 800, lessons: {} };
  const guestSnap = () =>
    (secure.setItemAsync.mock.calls as unknown as [string, unknown][])
      .filter(([key]) => key === "chessschool.guestProgress")
      .map(([, raw]) => String(raw));

  it("keeps the in-flight edit as guest progress when the push gets the 401", async () => {
    progressStore.beginSession("A");
    progressStore.set({ ...oldUser });
    const { ApiError } = await import("./api");
    apiMock.mockImplementationOnce((async () => {
      tokenBox.token = null; // api() clears the token, then calls the handler
      progressStore.expire();
      throw new ApiError(401, "unauthorized");
    }) as never);
    await mutateProgress((s) => ({ ...s, xp: 600 }));

    expect((progressStore.get() as { xp: number }).xp).toBe(600);
    expect(guestSnap().some((raw) => raw.includes('"xp":600'))).toBe(true);
  });

  it("A's late push reply after a 401 and a sign-in as B leaves B's cache alone", async () => {
    progressStore.beginSession("A");
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const done = mutateProgress((s) => ({ ...s, rating: 1600 }));
    await until(() => posts().length === 1);

    progressStore.expire(); // another request of A got the 401
    tokenBox.token = "tokB";
    progressStore.beginSession("B");
    apiMock.mockResolvedValueOnce({ ...userB });
    await syncProgressAfterAuth();
    flight.resolve({ ...ack, rating: 1900, streak: 9 });
    await done;

    const live = progressStore.get() as Record<string, unknown>;
    expect(live.user).toEqual({ id: "B" });
    expect(live.rating).toBe(800);
    expect(live.streak).toBeUndefined();
    expect(secure.setItemAsync).not.toHaveBeenCalled();
  });

  it("A's late GET after a 401 and a sign-in as B leaves B's cache alone", async () => {
    progressStore.beginSession("A");
    const getA = deferred();
    apiMock.mockReturnValueOnce(getA.promise as never);
    void fetchProgress(true);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.expire();
    tokenBox.token = "tokB";
    progressStore.beginSession("B");
    apiMock.mockResolvedValueOnce({ ...userB });
    await syncProgressAfterAuth();
    getA.resolve({ user: { id: "A" }, xp: 500, recentGames: [{ id: "gA" }] });
    await tick();

    expect((progressStore.get() as { user: { id: string } }).user.id).toBe("B");
    expect(secure.setItemAsync).not.toHaveBeenCalled(); // A's games were not cached
    expect(settings.hydrateSettings).toHaveBeenCalledTimes(1); // B's reply only
  });

  it("a sign-in as B after a 401 is not handed A's in-flight GET", async () => {
    progressStore.beginSession("A");
    const getA = deferred();
    const getB = deferred();
    apiMock
      .mockReturnValueOnce(getA.promise as never)
      .mockReturnValueOnce(getB.promise as never);
    void fetchProgress(true);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.expire();
    tokenBox.token = "tokB";
    progressStore.beginSession("B");
    const pendingB = fetchProgress(false);
    await until(() => apiMock.mock.calls.length === 2); // its own GET

    getB.resolve({ ...userB });
    expect(((await pendingB) as { user: { id: string } }).user.id).toBe("B");
    getA.resolve({ user: { id: "A" }, xp: 500 });
    await tick();
    expect((progressStore.get() as { user: { id: string } }).user.id).toBe("B");
  });

  it("A's late GET that fails with a 401 after a sign-in as B leaves B's cache alone", async () => {
    progressStore.beginSession("A");
    const getA = deferred();
    apiMock.mockReturnValueOnce(getA.promise as never);
    void fetchProgress(true);
    await until(() => apiMock.mock.calls.length === 1);

    progressStore.expire();
    tokenBox.token = "tokB";
    progressStore.beginSession("B");
    apiMock.mockResolvedValueOnce({ ...userB });
    await syncProgressAfterAuth();
    const { ApiError } = await import("./api");
    getA.resolve(Promise.reject(new ApiError(401, "unauthorized")));
    await tick();

    expect((progressStore.get() as { user: { id: string } }).user.id).toBe("B");
  });

  it("a sign-in as a different user drops the old user's cache even without a logout", () => {
    progressStore.beginSession("A");
    progressStore.set({ ...oldUser });
    progressStore.beginSession("B"); // e.g. a token adopted while A is still signed in
    expect(progressStore.get()).toBeNull();
  });

  it("a sign-in as the same user after a 401 keeps the edit, and an edit queued before it still runs", async () => {
    progressStore.beginSession("A");
    progressStore.set({ ...oldUser });
    const flight = deferred();
    apiMock.mockReturnValueOnce(flight.promise as never);
    const first = mutateProgress((s) => ({ ...s, xp: 600 }));
    await until(() => posts().length === 1);
    const queued = mutateProgress((s) => ({ ...s, xp: 700 })); // behind the push

    const { ApiError } = await import("./api");
    tokenBox.token = null;
    progressStore.expire(); // the 401
    flight.resolve(Promise.reject(new ApiError(401, "unauthorized")));
    await first;
    await queued; // same generation: it runs, as guest

    tokenBox.token = "tokA2";
    progressStore.beginSession("A"); // A signs in again
    expect((progressStore.get() as { xp: number }).xp).toBe(700); // the edit is still there
    apiMock.mockResolvedValueOnce({ ok: true, count: 1 });
    await mutateProgress((s) => s);
    expect((posts()[1][1] as { body: { xp: number } }).body.xp).toBe(700); // and goes out
  });
});
