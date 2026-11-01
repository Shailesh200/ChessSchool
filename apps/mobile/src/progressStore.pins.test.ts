import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Pins for four lines of the games cache that no test failed without (Imu's mutations
// M18, M22, M23, M26 on (j)). Each test fails when its line is reverted.

const GAMES = "chessschool.recentGamesCache";
const settle = (ms = 25) => new Promise((r) => setTimeout(r, ms));
const disk = vi.hoisted(() => new Map<string, string>());
const tokenBox = vi.hoisted(() => ({ token: "token" as string | null }));
/** When armed, `fire` runs `depth` microtasks after the games cache is read. */
const hook = vi.hoisted(() => ({ depth: -1, fire: null as null | (() => void) }));
const secure = vi.hoisted(() => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
  getItemAsync: vi.fn(async (k: string) => {
    const v = disk.get(k) ?? null;
    if (k === "chessschool.recentGamesCache" && hook.depth >= 0 && hook.fire) {
      const f = hook.fire;
      let d = hook.depth;
      hook.fire = null;
      const step = () => (d-- > 0 ? queueMicrotask(step) : f());
      queueMicrotask(step);
    }
    return v;
  }),
}));
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => secure);
vi.mock("./settings", () => ({
  hydrateSettings: vi.fn(),
  loadSettingsFromAccount: vi.fn(),
}));
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

type Store = typeof import("./progressStore");
async function boot() {
  vi.resetModules();
  const apiMod = await import("./api");
  vi.mocked(apiMod.api).mockReset();
  const store: Store = await import("./progressStore");
  return { ...store, apiMock: vi.mocked(apiMod.api) };
}
const acct = (id: string, games?: unknown[]) => ({
  user: { id },
  xp: 0,
  lessons: {},
  rating: 800,
  ...(games ? { recentGames: games } : {}),
});
const entry = (owner: string, games: unknown[]) =>
  JSON.stringify({ chessGames: 2, origin: "signed-in", owner, games });
const stored = () => (disk.has(GAMES) ? JSON.parse(disk.get(GAMES) as string) : null);

beforeEach(() => {
  disk.clear();
  tokenBox.token = "token-A";
  hook.depth = -1;
  hook.fire = null;
});

describe("games cache pins", () => {
  it("M18: a games write that is still running when clear() runs does not outlive the delete (the games operations are queued)", async () => {
    const b = await boot();
    b.apiMock.mockImplementation((async (_p: string, o?: { method?: string }) =>
      o?.method === "POST" ? { ok: true } : acct("A", [{ id: "gA1" }])) as never);
    b.progressStore.beginSession("A");
    await b.fetchProgress(true);
    await settle();
    expect(stored()?.games).toEqual([{ id: "gA1" }]);
    let release!: () => void;
    const held = new Promise<void>((r) => (release = r));
    secure.setItemAsync.mockImplementation(async (k: string, v: string) => {
      if (k === GAMES) await held;
      disk.set(k, v);
    });
    const edit = b.mutateProgress((s) => ({
      ...s,
      recentGames: [{ id: "gA1" }, { id: "gA9" }],
    }));
    await settle(); // the write of the games is held at the disk
    tokenBox.token = null;
    b.progressStore.clear(); // its delete must wait for that write, not run beside it
    release();
    await edit.catch(() => undefined);
    await settle(60);
    expect(disk.has(GAMES)).toBe(false);
    secure.setItemAsync.mockImplementation(
      async (k: string, v: string) => void disk.set(k, v),
    );
  });

  it("M22: adoptCachedGames does not overwrite games the snapshot already has", async () => {
    const b = await boot();
    b.apiMock.mockImplementation((async () => acct("A", [{ id: "live" }])) as never);
    b.progressStore.beginSession("A");
    await b.fetchProgress(true);
    await settle();
    disk.set(GAMES, entry("A", [{ id: "older-cached" }])); // A's own cache, older
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    expect(
      (b.progressStore.get() as { recentGames: { id: string }[] }).recentGames,
    ).toEqual([{ id: "live" }]);
  });

  it("M23: the games of a pull are tagged with the user of the reply, not the last user the app knew", async () => {
    const b = await boot();
    b.apiMock.mockImplementation((async () => acct("A")) as never);
    b.progressStore.beginSession("A");
    await b.fetchProgress(true);
    await settle();
    // B's token is in place and beginSession("B") has not run yet: lastUserId is still A
    tokenBox.token = "token-B";
    b.apiMock.mockImplementation((async () => acct("B", [{ id: "gB1" }])) as never);
    await b.fetchProgress(true);
    await settle();
    expect(stored()).toMatchObject({ origin: "signed-in", owner: "B" });
  });

  it("M26: a clear() one microtask after the cache read leaves none of A's games in memory (any depth)", async () => {
    const leaks: number[] = [];
    for (let d = 0; d < 16; d++) {
      disk.clear();
      const b = await boot();
      disk.set(GAMES, entry("A", [{ id: "gA" }]));
      b.progressStore.beginSession("A");
      await settle(10);
      disk.set(GAMES, entry("A", [{ id: "gA" }]));
      hook.depth = d;
      hook.fire = () => b.progressStore.clear();
      await b.progressStore.adoptCachedGames();
      await settle(10);
      if (JSON.stringify(b.progressStore.get() ?? null).includes("gA")) leaks.push(d);
    }
    expect(leaks).toEqual([]);
  });

  it("a pull reply with no user.id is cached with no owner and is never shown to anyone", async () => {
    const b = await boot();
    const noUser = { xp: 0, lessons: {}, rating: 800, recentGames: [{ id: "gX" }] };
    b.apiMock.mockImplementation((async () => noUser) as never);
    b.progressStore.beginSession("A"); // the app knows A, the reply does not say who it is
    await b.fetchProgress(true);
    await settle();
    expect(stored()).toMatchObject({ origin: "signed-in", owner: null });
    // A restart: A (the saved id) opens Shadow offline; then B signs in
    const c = await boot();
    await settle();
    expect(await c.progressStore.adoptCachedGames()).toBe(false);
    expect(JSON.stringify(c.progressStore.get() ?? null)).not.toContain("gX");
    c.progressStore.beginSession("B");
    await settle();
    expect(await c.progressStore.adoptCachedGames()).toBe(false);
    expect(JSON.stringify(c.progressStore.get() ?? null)).not.toContain("gX");
  });

  it("lastUserId unknown (null): adoptCachedGames adopts nothing and stamps no owner, even with a token and a signed-in cache entry", async () => {
    disk.set(GAMES, entry("A", [{ id: "gA-cached" }])); // a signed-in entry, owner A; no saved last user id
    tokenBox.token = "token-A";
    const b = await boot();
    await settle();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    const snap = b.progressStore.get() as Record<string, unknown> | null;
    expect(snap?.recentGames).toBeUndefined();
    expect(snap?.user).toBeUndefined(); // no owner stamped
    expect(JSON.stringify(snap ?? null)).not.toContain("gA-cached");
  });

  describe("A's own games stay visible to A offline (the owner tag is the account's user id)", () => {
    const game = { id: "gA-played" };
    /** The server: GET has `user`, the push reply has none (as the real API's). */
    const server = (b: Awaited<ReturnType<typeof boot>>, games: unknown[] = []) =>
      b.apiMock.mockImplementation((async (_p: string, o?: { method?: string }) =>
        o?.method === "POST" ? { ok: true, count: 1 } : acct("A", games)) as never);
    const offlineRestartShows = async () => {
      tokenBox.token = "token-A";
      const c = await boot();
      c.apiMock.mockImplementation((async () => {
        throw new Error("offline");
      }) as never);
      c.progressStore.beginSession("A");
      await settle();
      expect(await c.progressStore.adoptCachedGames()).toBe(true);
      return JSON.stringify(c.progressStore.get());
    };

    it("pulled, then plays a game: after a restart with no network A still sees it", async () => {
      const b = await boot();
      server(b);
      b.progressStore.beginSession("A");
      await b.fetchProgress(true);
      await b.mutateProgress((s) => ({ ...s, recentGames: [game] }));
      await settle();
      expect(stored()).toMatchObject({ origin: "signed-in", owner: "A" });
      expect(await offlineRestartShows()).toContain("gA-played");
    });

    it("restart offline, Shadow shows the cache, the network returns and A plays a game: the cache is still A's", async () => {
      disk.set(GAMES, entry("A", [{ id: "older" }]));
      disk.set("chessschool.lastUserId", "A");
      const b = await boot();
      b.progressStore.beginSession("A");
      await settle();
      expect(await b.progressStore.adoptCachedGames()).toBe(true); // snapshot has games, no user
      server(b, [{ id: "older" }]);
      await b.mutateProgress((s) => ({ ...s, recentGames: [game, { id: "older" }] }));
      await settle();
      expect(stored()).toMatchObject({ origin: "signed-in", owner: "A" });
      expect(await offlineRestartShows()).toContain("older");
    });
  });

  describe("the account's user never goes into a POST body (the snapshot carries it, the body must not)", () => {
    const ID = "user-A-77";
    const GUEST = "chessschool.guestProgress";
    /** GET carries `user`; the pull is an empty account, so a guest copy or the cache merges into it. */
    const empty = () => ({
      user: { id: ID, email: "a@x.test", name: "A", role: "student" },
      xp: 0,
      lessons: {},
      rating: 800,
    });
    /** Arc's scanner: after every test here, no POST body made by the store has a key named
     *  "user" at any depth (recursive; arrays and nested objects included). */
    const booted: Awaited<ReturnType<typeof boot>>[] = [];
    const hasUserKey = (v: unknown): boolean =>
      v !== null &&
      typeof v === "object" &&
      (Array.isArray(v)
        ? v.some(hasUserKey)
        : Object.keys(v).includes("user") || Object.values(v).some(hasUserKey));
    afterEach(() => {
      const seen = booted.splice(0);
      const bad = seen.flatMap((b) =>
        b.apiMock.mock.calls
          .filter(([, o]) => (o as { method?: string } | undefined)?.method === "POST")
          .map(([, o]) => (o as { body: unknown }).body)
          .filter(hasUserKey),
      );
      expect(bad, "a POST body has a `user` key (at any depth)").toEqual([]);
    });
    const serve = (b: Awaited<ReturnType<typeof boot>>) => (
      booted.push(b),
      b.apiMock.mockImplementation((async (_p: string, o?: { method?: string }) =>
        o?.method === "POST" ? { ok: true, count: 1 } : empty()) as never)
    );
    const bodies = (b: Awaited<ReturnType<typeof boot>>) =>
      b.apiMock.mock.calls
        .filter(([, o]) => (o as { method?: string } | undefined)?.method === "POST")
        .map(([, o]) => (o as { body: Record<string, unknown> }).body);
    const noUser = (list: Record<string, unknown>[]) => {
      expect(list.length).toBeGreaterThan(0);
      for (const body of list) {
        expect("user" in body).toBe(false);
        expect(JSON.stringify(body)).not.toContain(ID);
      }
    };
    /** A restart offline with A's games in the cache: the adopted snapshot gets A's id as its owner. */
    const adopted = async () => {
      disk.set(GAMES, entry(ID, [{ id: "older" }]));
      disk.set("chessschool.lastUserId", ID);
      const b = await boot();
      b.progressStore.beginSession(ID);
      await settle();
      expect(await b.progressStore.adoptCachedGames()).toBe(true);
      expect(b.progressStore.get()).toMatchObject({ user: { id: ID } }); // the injected owner
      return b;
    };

    it("mutate POST body after a pull has no user", async () => {
      const b = await boot();
      serve(b);
      b.progressStore.beginSession(ID);
      await b.fetchProgress(true);
      expect(b.progressStore.get()).toMatchObject({ user: { id: ID } });
      await b.mutateProgress((s) => ({ ...s, xp: 40 }));
      await settle();
      noUser(bodies(b));
      expect(bodies(b)[0]).toMatchObject({ xp: 40 });
    });

    it("mutate POST body after adoptCachedGames put the owner's id into the snapshot has no user", async () => {
      const b = await adopted();
      serve(b);
      await b.mutateProgress((s) => ({ ...s, xp: 41 }));
      await settle();
      noUser(bodies(b));
      expect(bodies(b)[0]).toMatchObject({ xp: 41 });
    });

    it("sync merge POST body (guest copy into an empty account) has no user", async () => {
      disk.set(GUEST, JSON.stringify({ xp: 5, lessons: {} }));
      const b = await boot();
      serve(b);
      b.progressStore.beginSession(ID);
      await b.syncProgressAfterAuth();
      await settle();
      noUser(bodies(b));
      expect(bodies(b)[0]).toMatchObject({ xp: 5 });
    });

    it("sync merge POST body after adoptCachedGames put the owner's id into the snapshot has no user", async () => {
      // A guest copy waits on disk, so the cache (with the injected owner) is merged with it.
      disk.set(GUEST, JSON.stringify({ xp: 7, lessons: {} }));
      const b = await adopted();
      serve(b);
      await b.syncProgressAfterAuth();
      await settle();
      noUser(bodies(b));
      expect(bodies(b)[0]).toMatchObject({ xp: 7 });
    });
  });
});
