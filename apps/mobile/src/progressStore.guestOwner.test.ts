import { beforeEach, describe, expect, it, vi } from "vitest";

// A session expiry keeps the in-flight edit as guest progress. The copy is one value on
// disk: { chessGuest: 2, origin, owner, snap }. origin "signed-in" (kept after an expiry)
// merges only for its owner and is dropped for anyone else, or when the owner is unknown.
// origin "guest" (made while signed out, or an older plain copy) merges into whoever signs
// in. An explicit logout drops a kept copy. "Restart" is a fresh module (boot()), never clear().

const GUEST = "chessschool.guestProgress";
const LAST_USER = "chessschool.lastUserId";
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const disk = vi.hoisted(() => new Map<string, string>());
const secure = vi.hoisted(() => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => disk.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
}));
const tokenBox = vi.hoisted(() => ({ token: "token" as string | null }));
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
type Api = typeof import("./api");
/** A fresh process: new module state, same disk. */
async function boot() {
  vi.resetModules();
  const apiMod: Api = await import("./api");
  vi.mocked(apiMod.api).mockReset(); // the mock object is shared across resets
  const store: Store = await import("./progressStore");
  return { ...store, apiMock: vi.mocked(apiMod.api), ApiError: apiMod.ApiError };
}
type Boot = Awaited<ReturnType<typeof boot>>;

const posts = (b: Boot) =>
  b.apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === "POST");
const emptyAccount = (id: string) => ({
  user: { id },
  xp: 0,
  lessons: {},
  rating: 800,
});
const stored = () => {
  const raw = disk.get(GUEST);
  return raw ? (JSON.parse(raw) as Record<string, unknown>) : null;
};

/** The push gets the 401: the api layer clears the token and calls expire(). */
function expireOnNextPush(b: Boot) {
  b.apiMock.mockImplementationOnce((async () => {
    tokenBox.token = null;
    b.progressStore.expire();
    throw new b.ApiError(401, "unauthorized");
  }) as never);
}

/** A signs in, edits, and the push gets the 401. */
async function expireAsA(b: Boot) {
  b.progressStore.beginSession("A");
  b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
  expireOnNextPush(b);
  await b.mutateProgress((s) => ({ ...s, xp: 600 }));
  b.apiMock.mockReset();
}

/** The next sign-in: server GET returns the account, the merge push is acknowledged. */
function signInWith(b: Boot, account: Record<string, unknown>) {
  tokenBox.token = "token-next";
  b.apiMock.mockImplementation(((_p: string, opts?: { method?: string }) =>
    Promise.resolve(
      opts?.method === "POST" ? { ok: true, count: 1 } : account,
    )) as never);
}

beforeEach(() => {
  disk.clear();
  tokenBox.token = "token";
  secure.setItemAsync.mockClear();
  secure.getItemAsync.mockImplementation(async (k: string) => disk.get(k) ?? null);
  secure.setItemAsync.mockImplementation(
    async (k: string, v: string) => void disk.set(k, v),
  );
});

describe("expire()", () => {
  it("empties the cache (a guest browsing after the expiry does not see the old user's snapshot)", async () => {
    const b = await boot();
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    expect(b.progressStore.get()).not.toBeNull();
    b.progressStore.expire();
    expect(b.progressStore.get()).toBeNull();
  });
});

describe("the copy kept after a session expiry carries its origin and owner", () => {
  it("is written as one value: origin signed-in, the owner, and the snapshot", async () => {
    const b = await boot();
    await expireAsA(b);
    const guestWrites = secure.setItemAsync.mock.calls.filter(([k]) => k === GUEST);
    expect(guestWrites).toHaveLength(1);
    expect([...disk.keys()].sort()).toEqual([GUEST, LAST_USER]); // the copy and the saved last user id
    expect(stored()).toMatchObject({
      chessGuest: 2,
      origin: "signed-in",
      owner: "A",
      snap: { xp: 600 },
    });
  });

  it("B signing in after A's 401 and an app restart gets none of A's progress, and the copy is dropped", async () => {
    await expireAsA(await boot());
    const b = await boot(); // restart: no in-memory state, only the stored copy
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("B signing in without a restart (A's edit still in memory) gets none of A's progress either", async () => {
    const b = await boot();
    await expireAsA(b);
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("A signing in again after the 401 and a restart gets their own progress back", async () => {
    await expireAsA(await boot());
    const b = await boot();
    b.progressStore.beginSession("A");
    signInWith(b, emptyAccount("A"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect(posts(b)).toHaveLength(1);
    expect((posts(b)[0][1] as { body: { xp: number } }).body.xp).toBe(600);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("an older plain guest copy (no envelope) still merges into the account that signs in", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 40, lessons: {} }));
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect((posts(b)[0][1] as { body: { xp: number } }).body.xp).toBe(40);
  });

  it("a guest copy made while signed out (origin guest) merges into whoever signs in", async () => {
    let b = await boot();
    tokenBox.token = null;
    await b.mutateProgress((s) => ({ ...s, xp: 40 }));
    expect(stored()).toMatchObject({ origin: "guest", owner: null });
    b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect((posts(b)[0][1] as { body: { xp: number } }).body.xp).toBe(40);
  });

  it("a guest edit made after the expiry keeps the origin and the owner", async () => {
    await expireAsA(await boot());
    const b = await boot();
    tokenBox.token = null;
    await b.mutateProgress((s) => ({ ...s, xp: 650 }));
    expect(stored()).toMatchObject({
      origin: "signed-in",
      owner: "A",
      snap: { xp: 650 },
    });
  });
});

describe("IMU P1: a restart, then a guest browse loads A's kept copy into the cache, then B signs in", () => {
  it("fetchProgress path: nothing of A reaches B", async () => {
    await expireAsA(await boot());
    disk.delete(LAST_USER); // the saved id is gone (unreadable store): the restart has no last user
    const b = await boot(); // lastUserId is null
    tokenBox.token = null;
    await b.fetchProgress(false); // restoreGuestBrowse(): the cache holds A's copy
    expect((b.progressStore.get() as { xp: number }).xp).toBe(600);
    b.progressStore.beginSession("B"); // no bump: lastUserId was null
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("mutateProgress guest path: a guest edit loaded A's copy into the cache, then B signs in: nothing of A reaches B", async () => {
    await expireAsA(await boot());
    disk.delete(LAST_USER);
    const b = await boot();
    tokenBox.token = null;
    await b.mutateProgress((s) => ({ ...s, xp: 650 }));
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
  });

  it("the same user who signs in with A's copy in the cache still gets it merged", async () => {
    await expireAsA(await boot());
    disk.delete(LAST_USER);
    const b = await boot();
    tokenBox.token = null;
    await b.fetchProgress(false);
    b.progressStore.beginSession("A");
    signInWith(b, emptyAccount("A"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect((posts(b)[0][1] as { body: { xp: number } }).body.xp).toBe(600);
  });
});

describe("IMU P2: a crash cannot leave a kept copy without its owner", () => {
  it("a crash while the copy is written leaves no copy (the owner is inside it), so nothing merges into B", async () => {
    const b = await boot();
    b.progressStore.beginSession("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    expireOnNextPush(b);
    secure.setItemAsync.mockImplementation(async () => {
      throw new Error("crash");
    });
    await b.mutateProgress((s) => ({ ...s, xp: 600 })).catch(() => undefined);
    secure.setItemAsync.mockImplementation(
      async (k: string, v: string) => void disk.set(k, v),
    );
    const c = await boot();
    c.progressStore.beginSession("B");
    signInWith(c, emptyAccount("B"));
    expect((await c.syncProgressAfterAuth()).merged).toBe(false);
    expect(posts(c)).toHaveLength(0);
  });
});

describe("a cold-start 401 fails closed", () => {
  /** The app restarted and /me was unreachable: lastUserId is null when the push gets the 401. */
  async function coldStart401() {
    const b = await boot();
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    expireOnNextPush(b);
    await b.mutateProgress((s) => ({ ...s, xp: 600 }));
  }

  it("keeps the copy as from a signed-in session with no owner", async () => {
    await coldStart401();
    expect(stored()).toMatchObject({
      origin: "signed-in",
      owner: null,
      snap: { xp: 600 },
    });
  });

  it("B signing in afterwards gets nothing of A's", async () => {
    await coldStart401();
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("A signing in afterwards does not get it either (the owner was never known)", async () => {
    await coldStart401();
    const b = await boot();
    b.progressStore.beginSession("A");
    signInWith(b, emptyAccount("A"));
    expect((await b.syncProgressAfterAuth()).merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
  });
});

describe("the kept copy is checked wherever the sync starts", () => {
  it("an owner-less kept copy is never merged, even when no sign-in told the store who signed in", async () => {
    let b = await boot();
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    expireOnNextPush(b);
    await b.mutateProgress((s) => ({ ...s, xp: 600 }));
    b = await boot(); // lastUserId is null here: owner null must not equal it
    signInWith(b, emptyAccount("B"));
    expect((await b.syncProgressAfterAuth()).merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
  });

  it("when the account pull fails, A's copy is not left in the cache for B", async () => {
    await expireAsA(await boot());
    disk.delete(LAST_USER); // no saved last user: no generation bump at B's sign-in
    const b = await boot();
    tokenBox.token = null;
    await b.fetchProgress(false); // the cache holds A's copy
    b.progressStore.beginSession("B");
    tokenBox.token = "token-next";
    b.apiMock.mockRejectedValue(new Error("offline"));
    await expect(b.syncProgressAfterAuth()).rejects.toThrow("offline");
    expect(b.progressStore.get()).toBeNull();
    expect(disk.has(GUEST)).toBe(false);
  });

  it("a logout while the copy is read stops the sync: no pull, no push", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 40, lessons: {} }));
    const b = await boot();
    b.progressStore.beginSession("A");
    signInWith(b, emptyAccount("A"));
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    secure.getItemAsync.mockImplementation(async (k: string) => {
      await gate;
      return disk.get(k) ?? null;
    });
    const sync = b.syncProgressAfterAuth();
    await Promise.resolve();
    b.progressStore.clear();
    release();
    expect(await sync).toEqual({ snap: null, merged: false });
    expect(b.apiMock).not.toHaveBeenCalled();
  });
});

describe("an explicit logout drops the kept copy (Arc's case 3)", () => {
  it("A edits, the session expires, A logs out and signs back in: the kept copy is gone", async () => {
    const b = await boot();
    await expireAsA(b);
    expect(disk.has(GUEST)).toBe(true);
    b.progressStore.clear(); // explicit logout
    b.progressStore.beginSession("A");
    signInWith(b, emptyAccount("A"));
    const out = await b.syncProgressAfterAuth();
    expect(disk.has(GUEST)).toBe(false);
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
  });

  it("the copy is gone from the disk right after logout, even before another sign-in", async () => {
    const b = await boot();
    await expireAsA(b);
    b.progressStore.clear();
    tokenBox.token = null;
    expect(await b.fetchProgress(true)).toBeNull(); // guest browse after the logout
    expect(disk.has(GUEST)).toBe(false);
  });

  it("a plain guest copy (made while signed out) survives a logout", async () => {
    const b = await boot();
    tokenBox.token = null;
    await b.mutateProgress((s) => ({ ...s, xp: 40 }));
    b.progressStore.clear();
    await b.fetchProgress(true);
    expect(stored()).toMatchObject({ origin: "guest", snap: { xp: 40 } });
  });
});

describe("an explicit logout forgets the last user id (a late 401 cannot tag a copy to the old user)", () => {
  /** A request that starts after the logout with a token that is still around: GET fails, the push gets the 401. */
  function staleTokenGets401(b: Boot) {
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) => {
      if (opts?.method !== "POST") throw new b.ApiError(500, "down");
      tokenBox.token = null;
      b.progressStore.expire();
      throw new b.ApiError(401, "unauthorized");
    }) as never);
  }

  it("A signs in, logs out, then a 401 keeps a copy that is NOT tagged to A, and it merges into neither A nor B", async () => {
    const b = await boot();
    b.progressStore.beginSession("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.progressStore.clear(); // explicit logout
    await settle();
    staleTokenGets401(b);
    await b.mutateProgress((s) => ({ ...s, xp: 700 }));
    expect(stored()).toMatchObject({
      origin: "signed-in",
      owner: null,
      snap: { xp: 700 },
    });
    expect(JSON.stringify(stored())).not.toContain('"A"');
    const copy = disk.get(GUEST) as string;
    for (const who of ["A", "B"]) {
      disk.clear();
      disk.set(GUEST, copy);
      tokenBox.token = "token";
      const c = await boot(); // restart: only the stored copy
      c.progressStore.beginSession(who);
      signInWith(c, emptyAccount(who));
      const out = await c.syncProgressAfterAuth();
      expect(out.merged).toBe(false);
      expect(posts(c)).toHaveLength(0);
      expect((c.progressStore.get() as { xp: number }).xp).toBe(0);
      expect(disk.has(GUEST)).toBe(false);
    }
  });

  it("the same after an app restart: the saved last user id is gone too, so the 401 is untagged", async () => {
    const first = await boot();
    first.progressStore.beginSession("A");
    first.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    first.progressStore.clear();
    await settle();
    // no value on the disk carries A's id after the logout
    expect([...disk.values()].join("|")).not.toContain("A");
    const b = await boot(); // restart
    staleTokenGets401(b);
    await b.mutateProgress((s) => ({ ...s, xp: 700 }));
    expect(stored()).toMatchObject({ origin: "signed-in", owner: null });
  });
});

describe("the last user id is saved, so a cold-start 401 after a restart knows whose session expired", () => {
  function staleToken(b: Boot) {
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) => {
      if (opts?.method !== "POST") throw new b.ApiError(500, "down");
      tokenBox.token = null;
      b.progressStore.expire();
      throw new b.ApiError(401, "unauthorized");
    }) as never);
  }
  async function signedInAsAThenRestart() {
    const first = await boot();
    first.progressStore.beginSession("A");
    await settle();
    expect(disk.get(LAST_USER)).toBe("A");
    return boot(); // the app restarts; the token is stale
  }

  it("(i) A signs in, the app restarts, a cold 401 keeps a copy tagged A, and A gets it back on sign-in", async () => {
    const b = await signedInAsAThenRestart();
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    staleToken(b);
    await b.mutateProgress((s) => ({ ...s, xp: 700 }));
    expect(stored()).toMatchObject({
      origin: "signed-in",
      owner: "A",
      snap: { xp: 700 },
    });
    const c = await boot();
    c.progressStore.beginSession("A");
    signInWith(c, emptyAccount("A"));
    const out = await c.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect((posts(c)[0][1] as { body: { xp: number } }).body.xp).toBe(700);
  });

  it("(i) and B signing in after that cold 401 gets none of A's progress", async () => {
    const b = await signedInAsAThenRestart();
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    staleToken(b);
    await b.mutateProgress((s) => ({ ...s, xp: 700 }));
    const c = await boot();
    c.progressStore.beginSession("B");
    signInWith(c, emptyAccount("B"));
    const out = await c.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(c)).toHaveLength(0);
    expect((c.progressStore.get() as { xp: number }).xp).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("the 401 waits for the saved id when the read is slow (the copy is still tagged A)", async () => {
    const b = await signedInAsAThenRestart();
    // another restart where reading the saved id takes a while
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === LAST_USER) await new Promise((r) => setTimeout(r, 40));
      return disk.get(k) ?? null;
    });
    const slow = await boot();
    slow.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    staleToken(slow);
    await slow.mutateProgress((s) => ({ ...s, xp: 700 }));
    expect(stored()).toMatchObject({ origin: "signed-in", owner: "A" });
    void b;
  });

  it("(ii) A logs out, the app restarts, a cold 401 tags nobody, so neither A nor B gets the copy", async () => {
    const first = await boot();
    first.progressStore.beginSession("A");
    await settle();
    first.progressStore.clear(); // explicit logout
    await settle();
    expect(disk.has(LAST_USER)).toBe(false);
    const b = await boot(); // restart
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    staleToken(b);
    await b.mutateProgress((s) => ({ ...s, xp: 700 }));
    expect(stored()).toMatchObject({ origin: "signed-in", owner: null });
    const copy = disk.get(GUEST) as string;
    for (const who of ["A", "B"]) {
      disk.clear();
      disk.set(GUEST, copy);
      tokenBox.token = "token";
      const c = await boot();
      c.progressStore.beginSession(who);
      signInWith(c, emptyAccount(who));
      expect((await c.syncProgressAfterAuth()).merged).toBe(false);
      expect(posts(c)).toHaveLength(0);
      expect(disk.has(GUEST)).toBe(false);
    }
  });

  it("a different user signing in replaces the saved id", async () => {
    const b = await boot();
    b.progressStore.beginSession("A");
    b.progressStore.beginSession("B");
    await settle();
    expect(disk.get(LAST_USER)).toBe("B");
  });

  it("a saved id read late does not override a user who signed in meanwhile", async () => {
    disk.set(LAST_USER, "A");
    secure.getItemAsync.mockImplementation(async (k: string) => {
      const v = disk.get(k) ?? null;
      if (k === LAST_USER) await new Promise((r) => setTimeout(r, 40));
      return v;
    });
    const b = await boot();
    b.progressStore.beginSession("B"); // before the saved "A" is read
    await settle(80);
    b.progressStore.set({ user: { id: "B" }, xp: 10, lessons: {} });
    staleToken(b);
    await b.mutateProgress((s) => ({ ...s, xp: 5 }));
    expect(stored()).toMatchObject({ owner: "B" });
  });
});

describe("an origin other than exactly guest counts as signed-in (fails closed)", () => {
  it.each([
    [
      "an unknown origin",
      { chessGuest: 2, origin: "weird", owner: null, snap: { xp: 5, lessons: {} } },
    ],
    ["a missing origin", { chessGuest: 2, owner: null, snap: { xp: 5, lessons: {} } }],
    [
      "a different case",
      { chessGuest: 2, origin: "Guest", owner: null, snap: { xp: 5, lessons: {} } },
    ],
    [
      "a non-string origin",
      { chessGuest: 2, origin: true, owner: null, snap: { xp: 5, lessons: {} } },
    ],
  ])("%s: B signing in gets none of it and the copy is dropped", async (_n, value) => {
    disk.set(GUEST, JSON.stringify(value));
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("exactly guest still merges into whoever signs in", async () => {
    disk.set(
      GUEST,
      JSON.stringify({
        chessGuest: 2,
        origin: "guest",
        owner: null,
        snap: { xp: 5, lessons: {} },
      }),
    );
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    expect((await b.syncProgressAfterAuth()).merged).toBe(true);
  });
});

describe("the guest copy only enters the cache for the session that asked", () => {
  /** getItemAsync for the guest key waits until released. */
  function gateGuestRead() {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === GUEST) await gate;
      return disk.get(k) ?? null;
    });
    return release;
  }

  it("mutateProgress: a logout while the guest copy loads does not put it in the cache", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 40, lessons: {} }));
    const b = await boot();
    tokenBox.token = null;
    const release = gateGuestRead();
    const edit = b.mutateProgress((s) => ({ ...s, xp: 99 }));
    await Promise.resolve();
    b.progressStore.clear();
    release();
    await edit;
    expect(b.progressStore.get()).toBeNull();
  });

  it("fetchProgress: a logout while the guest copy loads does not put it in the cache", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 40, lessons: {} }));
    const b = await boot();
    tokenBox.token = null;
    const release = gateGuestRead();
    const read = b.fetchProgress(true);
    await Promise.resolve();
    b.progressStore.clear();
    release();
    await read;
    expect(b.progressStore.get()).toBeNull();
  });
});
