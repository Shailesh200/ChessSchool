import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// The recent-games cache is tagged with its owner. Another user's games are never shown
// (the Shadow screen loads them through adoptCachedGames) and never pushed.

const GUEST = "chessschool.guestProgress";
const GAMES = "chessschool.recentGamesCache";
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
async function boot() {
  vi.resetModules();
  const apiMod: Api = await import("./api");
  vi.mocked(apiMod.api).mockReset();
  const store: Store = await import("./progressStore");
  return { ...store, apiMock: vi.mocked(apiMod.api) };
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
  secure.getItemAsync.mockImplementation(async (k: string) => disk.get(k) ?? null);
  secure.setItemAsync.mockImplementation(
    async (k: string, v: string) => void disk.set(k, v),
  );
});

const gA = [
  { id: "gA1", result: "win", by: "A" },
  { id: "gA2", result: "loss", by: "A" },
];
const gB = { id: "gB1", result: "win", by: "B" };
const acct = (id: string, games?: unknown[]) => ({
  ...emptyAccount(id),
  ...(games ? { recentGames: games } : {}),
});
const stored = () => (disk.has(GAMES) ? JSON.parse(disk.get(GAMES) as string) : null);
const ids = (v: unknown) =>
  ((v as Array<{ id: string }> | null) ?? []).map((g) => g.id);

/** A is signed in on a fresh boot and pulls their account, so their games are cached. */
async function aPulled() {
  tokenBox.token = "token-A";
  const b = await boot();
  b.apiMock.mockImplementation((async () => acct("A", gA)) as never);
  b.progressStore.beginSession("A");
  await b.fetchProgress(true);
  await settle();
  return b;
}
/** Offline: every request fails. */
function goOffline(b: Boot) {
  b.apiMock.mockReset();
  b.apiMock.mockImplementation((async () => {
    throw new Error("Network request failed");
  }) as never);
}

describe("(j) the games cache is tagged with its owner", () => {
  it("a pull writes the games with the account they came from", async () => {
    await aPulled();
    expect(stored()).toEqual({
      chessGames: 2,
      origin: "signed-in",
      owner: "A",
      games: gA,
    });
  });

  it("the tag is the user in the reply, even before the app knows who is signed in", async () => {
    tokenBox.token = "token-B";
    const b = await boot();
    b.apiMock.mockImplementation((async () => acct("B", [gB])) as never);
    await b.fetchProgress(true);
    await settle();
    expect(stored()).toMatchObject({ origin: "signed-in", owner: "B", games: [gB] });
  });

  it("a signed-in game played is cached for its player", async () => {
    const b = await aPulled();
    await b.mutateProgress((s) => ({
      ...s,
      recentGames: [gB, ...(s?.recentGames as unknown[])],
    }));
    await settle();
    expect(stored()).toMatchObject({ origin: "signed-in", owner: "A" });
    expect(ids(stored().games)).toEqual(["gB1", "gA1", "gA2"]);
  });

  it("a guest's games are cached as a guest's", async () => {
    tokenBox.token = null;
    const b = await boot();
    await b.mutateProgress((s) => ({ ...s, recentGames: [gB] }));
    await settle();
    expect(stored()).toEqual({
      chessGames: 2,
      origin: "guest",
      owner: null,
      games: [gB],
    });
    expect(ids(await b.progressStore.loadCachedGames())).toEqual(["gB1"]);
  });
});

describe("(j) A's own cache still works for A", () => {
  it("offline after a restart, A sees their games on Shadow", async () => {
    await aPulled();
    const b = await boot();
    goOffline(b);
    b.progressStore.beginSession("A");
    expect(ids(await b.progressStore.loadCachedGames())).toEqual(["gA1", "gA2"]);
    expect(await b.progressStore.adoptCachedGames()).toBe(true);
    expect(
      ids((b.progressStore.get() as { recentGames: unknown[] }).recentGames),
    ).toEqual(["gA1", "gA2"]);
    expect(stored()?.owner).toBe("A");
  });

  it("the saved last user is enough before beginSession runs", async () => {
    await aPulled();
    disk.set("chessschool.lastUserId", "A");
    const b = await boot();
    goOffline(b);
    expect(ids(await b.progressStore.loadCachedGames())).toEqual(["gA1", "gA2"]);
  });

  it("A signing in again keeps their cache (beginSession for the owner does not delete it)", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    await settle();
    expect(stored()?.owner).toBe("A");
  });

  it("A's games are pushed as A's, with A's next game", async () => {
    const b = await aPulled();
    b.apiMock.mockClear();
    await b.mutateProgress((s) => ({
      ...s,
      recentGames: [gB, ...(s?.recentGames as unknown[])],
    }));
    expect(
      ids((posts(b)[0][1] as { body: { recentGames: unknown[] } }).body.recentGames),
    ).toEqual(["gB1", "gA1", "gA2"]);
  });
});

describe("(j) another user, or nobody, never gets A's games", () => {
  it("B signs in on the same phone: A's cache is deleted, B is offline and sees none (Shadow)", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A"); // the previous run's user is known
    tokenBox.token = "token-B";
    goOffline(b);
    b.progressStore.beginSession("B");
    await settle();
    expect(disk.has(GAMES)).toBe(false);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    expect(b.progressStore.get()?.recentGames).toBeUndefined();
  });

  it("B before the pull, in the same app run as A, sees none of A's", async () => {
    const b = await aPulled();
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    goOffline(b);
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(b.progressStore.get()?.recentGames).toBeUndefined();
  });

  it("the cache is not read for B even if the delete did not land yet (owner check on read)", async () => {
    await aPulled();
    // The app knows B is signed in (saved last user) but beginSession has not run.
    disk.set("chessschool.lastUserId", "B");
    const b = await boot();
    goOffline(b);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
  });

  it("the cache is not read when the app does not know who is signed in", async () => {
    await aPulled();
    disk.delete("chessschool.lastUserId");
    const b = await boot();
    goOffline(b);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
  });

  it("B signs in with nobody known before (a first beginSession): A's cache is deleted", async () => {
    await aPulled();
    const b = await boot();
    goOffline(b);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle();
    expect(disk.has(GAMES)).toBe(false);
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
  });

  it("logout deletes the cache, and a guest after A logs out sees none of A's games", async () => {
    const b = await aPulled();
    expect(disk.has(GAMES)).toBe(true);
    tokenBox.token = null;
    b.progressStore.clear();
    await settle();
    expect(disk.has(GAMES)).toBe(false);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    expect(b.progressStore.get()?.recentGames).toBeUndefined();
  });

  it("a guest on a fresh boot cannot read A's cache even if it was never deleted", async () => {
    await aPulled();
    tokenBox.token = null;
    const b = await boot();
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
    expect(b.progressStore.get()?.recentGames).toBeUndefined();
  });

  it("an older build's untagged cache (a plain array) is never shown, to a user or a guest, and is deleted", async () => {
    for (const token of ["token-A", null]) {
      disk.set(GAMES, JSON.stringify(gA));
      disk.set("chessschool.lastUserId", "A");
      tokenBox.token = token;
      const b = await boot();
      goOffline(b);
      expect(await b.progressStore.loadCachedGames()).toBeNull();
      expect(disk.has(GAMES)).toBe(false);
    }
  });

  it("damaged tagged values are never shown and are deleted", async () => {
    const bad = [
      { chessGames: 2, origin: "signed-in", owner: "A", games: "x" },
      { chessGames: 2, origin: "signed-in", owner: "A" },
      { chessGames: 1, origin: "signed-in", owner: "A", games: gA },
      { origin: "signed-in", owner: "A", games: gA },
      "{oops",
    ];
    for (const v of bad) {
      disk.set(GAMES, typeof v === "string" ? v : JSON.stringify(v));
      disk.set("chessschool.lastUserId", "A");
      tokenBox.token = "token-A";
      const b = await boot();
      expect(await b.progressStore.loadCachedGames()).toBeNull();
      expect(disk.has(GAMES)).toBe(false);
    }
  });

  it("a tagged value with no owner, or an unknown origin, is never shown to a signed-in user", async () => {
    for (const tag of [
      { origin: "signed-in", owner: null },
      { origin: "guest", owner: null },
      { origin: "guest", owner: "A" },
      {},
    ]) {
      disk.set(GAMES, JSON.stringify({ chessGames: 2, ...tag, games: gA }));
      disk.set("chessschool.lastUserId", "A");
      tokenBox.token = "token-A";
      const b = await boot();
      expect(await b.progressStore.loadCachedGames()).toBeNull();
    }
  });

  it.each([
    ["an unknown origin", { origin: "weird", owner: null }],
    ["an unknown origin with an owner", { origin: "weird", owner: "A" }],
    ["a different case", { origin: "Guest", owner: null }],
    ["a non-string origin", { origin: true, owner: null }],
    ["a missing origin", { owner: null }],
  ])(
    "%s counts as signed-in (fails closed): a guest never sees the games",
    async (_n, tag) => {
      disk.set(GAMES, JSON.stringify({ chessGames: 2, ...tag, games: gA }));
      tokenBox.token = null;
      const b = await boot();
      expect(await b.progressStore.loadCachedGames()).toBeNull();
      expect(await b.progressStore.adoptCachedGames()).toBe(false);
    },
  );

  it("a cache with no owner is not shown even when the app does not know who is signed in", async () => {
    disk.set(
      GAMES,
      JSON.stringify({ chessGames: 2, origin: "signed-in", owner: null, games: gA }),
    );
    tokenBox.token = "token-A";
    const b = await boot();
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(await b.progressStore.adoptCachedGames()).toBe(false);
  });

  it("a guest's own cache is not shown to the user who signs in afterwards", async () => {
    tokenBox.token = null;
    const g = await boot();
    await g.mutateProgress((s) => ({ ...s, recentGames: [gB] }));
    await settle();
    tokenBox.token = "token-B";
    const b = await boot();
    goOffline(b);
    b.progressStore.beginSession("B");
    await settle();
    expect(await b.progressStore.loadCachedGames()).toBeNull();
    expect(disk.has(GAMES)).toBe(false);
  });

  it("a guest who builds on a kept copy of A does not make A's games a guest's cache", async () => {
    disk.set(
      GUEST,
      JSON.stringify({
        chessGuest: 2,
        origin: "signed-in",
        owner: "A",
        snap: { xp: 5, recentGames: gA },
      }),
    );
    tokenBox.token = null;
    const b = await boot();
    await b.mutateProgress((s) => ({
      ...s,
      recentGames: [gB, ...((s?.recentGames as unknown[]) ?? [])],
    }));
    await settle();
    expect(stored()).toMatchObject({ origin: "signed-in", owner: "A" });
    expect(await b.progressStore.loadCachedGames()).toBeNull();
  });
});

describe("(j) A's games are never pushed into B's account", () => {
  it("B offline, then B plays: the push has only B's game", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    tokenBox.token = "token-B";
    goOffline(b);
    b.progressStore.beginSession("B");
    await b.progressStore.adoptCachedGames(); // what the Shadow screen does on open
    // B comes online: the pull works, B has no games yet.
    b.apiMock.mockReset();
    b.apiMock.mockImplementation(((_p: string, o?: { method?: string }) =>
      Promise.resolve(o?.method === "POST" ? { ok: true } : acct("B"))) as never);
    await b.mutateProgress((s) => ({
      ...s,
      recentGames: [gB, ...((s?.recentGames as unknown[]) ?? [])],
    }));
    const sent = posts(b).map((p) =>
      ids((p[1] as { body: { recentGames?: unknown[] } }).body.recentGames),
    );
    expect(sent).toEqual([["gB1"]]);
    expect(JSON.stringify(posts(b))).not.toContain("gA1");
  });

  it("B on Shadow while the pull is down, then a push: A's games are not in the body", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    b.apiMock.mockReset();
    b.apiMock.mockImplementation(((_p: string, o?: { method?: string }) =>
      o?.method === "POST"
        ? Promise.resolve({ ok: true })
        : Promise.reject(new Error("offline"))) as never);
    await b.progressStore.adoptCachedGames();
    await b.mutateProgress((s) => ({ ...s, xp: 5 }));
    expect(JSON.stringify(b.apiMock.mock.calls)).not.toContain("gA1");
  });

  it("the merge after sign-in does not send A's cached games either", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await b.progressStore.adoptCachedGames();
    disk.set(
      GUEST,
      JSON.stringify({ chessGuest: 2, origin: "guest", owner: null, snap: { xp: 7 } }),
    );
    signInWith(b, acct("B"));
    b.apiMock.mockClear();
    await b.syncProgressAfterAuth();
    expect(posts(b)).toHaveLength(1);
    expect(JSON.stringify(b.apiMock.mock.calls)).not.toContain("gA1");
  });

  it("a read that is still running when B signs in does not put A's games into the snapshot", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    goOffline(b);
    // The disk read of the cache is slow.
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === GAMES) await gate;
      return disk.get(k) ?? null;
    });
    const adopting = b.progressStore.adoptCachedGames();
    await settle();
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    release();
    expect(await adopting).toBe(false);
    expect(b.progressStore.get()?.recentGames).toBeUndefined();
    b.apiMock.mockReset();
    b.apiMock.mockImplementation(((_p: string, o?: { method?: string }) =>
      Promise.resolve(o?.method === "POST" ? { ok: true } : acct("B"))) as never);
    await b.mutateProgress((s) => ({ ...s, xp: 1 }));
    expect(JSON.stringify(b.apiMock.mock.calls)).not.toContain("gA1");
  });

  it("a write of A's games still waiting when A logs out is skipped (not written after the delete)", async () => {
    tokenBox.token = "token-A";
    const b = await boot();
    b.progressStore.beginSession("A");
    let release: () => void = () => undefined;
    const gate = new Promise<void>((r) => (release = r));
    b.apiMock.mockImplementation((async () => {
      await gate;
      return acct("A", gA);
    }) as never);
    const pulling = b.fetchProgress(true);
    await settle();
    tokenBox.token = null;
    b.progressStore.clear();
    release();
    await pulling.catch(() => undefined);
    await settle();
    expect(disk.has(GAMES)).toBe(false);
    expect(await b.progressStore.loadCachedGames()).toBeNull();
  });
});

describe("(j) reads and writes that outlive the session", () => {
  const gate = () => {
    let release: () => void = () => undefined;
    const p = new Promise<void>((r) => (release = r));
    return { p, release };
  };

  it("a read waits for the saved last user id: A's own cache shows for A on a cold start", async () => {
    await aPulled();
    const g = gate();
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === "chessschool.lastUserId") await g.p;
      return disk.get(k) ?? null;
    });
    const b = await boot();
    goOffline(b);
    const loading = b.progressStore.loadCachedGames();
    await settle();
    g.release();
    expect(ids(await loading)).toEqual(["gA1", "gA2"]);
  });

  it("a read still running when the user logs out returns nothing", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    goOffline(b);
    const g = gate();
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === GAMES) await g.p;
      return disk.get(k) ?? null;
    });
    const loading = b.progressStore.loadCachedGames();
    await settle();
    tokenBox.token = null;
    b.progressStore.clear();
    g.release();
    expect(await loading).toBeNull();
  });

  it("a read that began before a logout never returns after it, even when the same user signs back in", async () => {
    await aPulled();
    const b = await boot();
    b.progressStore.beginSession("A");
    goOffline(b);
    const g = gate();
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === GAMES) await g.p;
      return disk.get(k) ?? null;
    });
    const loading = b.progressStore.loadCachedGames();
    await settle();
    b.progressStore.clear();
    b.progressStore.beginSession("A");
    g.release();
    expect(await loading).toBeNull();
  });

  it("a guest's games write that was queued before a logout is not written after it", async () => {
    tokenBox.token = null;
    const b = await boot();
    const g = gate();
    let held = false;
    secure.setItemAsync.mockImplementation(async (k: string, v: string) => {
      if (k === GUEST && !held) {
        held = true;
        await g.p;
      }
      disk.set(k, v);
    });
    const playing = b.mutateProgress((s) => ({ ...s, recentGames: [gB] }));
    await settle();
    b.progressStore.clear();
    await settle();
    g.release();
    await playing.catch(() => undefined);
    await settle();
    expect(disk.has(GAMES)).toBe(false);
  });

  it("clear() forgets the last user: a late disk read cannot bring the old user back", async () => {
    await aPulled(); // the saved last user is A and A's cache is on disk
    const g = gate();
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === "chessschool.lastUserId") await g.p;
      return disk.get(k) ?? null;
    });
    const b = await boot();
    goOffline(b);
    b.progressStore.clear(); // logout while the saved id is still loading
    tokenBox.token = "token-A";
    const loading = b.progressStore.loadCachedGames();
    await settle();
    g.release();
    disk.set(
      GAMES,
      JSON.stringify({ chessGames: 2, origin: "signed-in", owner: "A", games: gA }),
    );
    expect(await loading).toBeNull();
  });
});

describe("(j) the one way cached games enter the snapshot is guarded", () => {
  const read = (p: string) => readFileSync(join(__dirname, "..", p), "utf8");
  function sources(dir: string): string[] {
    return readdirSync(join(__dirname, "..", dir), { withFileTypes: true }).flatMap(
      (e) => {
        const rel = `${dir}/${e.name}`;
        if (e.isDirectory()) return sources(rel);
        return /\.(ts|tsx)$/.test(e.name) && !/\.test\./.test(e.name) ? [rel] : [];
      },
    );
  }

  it("the Shadow screen loads its cache only through adoptCachedGames and never sets the snapshot itself", () => {
    const shadow = read("app/play/shadow.tsx");
    expect(shadow).toMatch(/progressStore\.adoptCachedGames\(\)/);
    expect(shadow).not.toMatch(/loadCachedGames/);
    expect(shadow).not.toMatch(/progressStore\.set\(/);
  });

  it("no app or src code outside the store sets the snapshot or reads the games cache directly", () => {
    for (const f of [...sources("app"), ...sources("src")]) {
      if (f === "src/progressStore.ts") continue;
      const text = read(f);
      expect(text, f).not.toMatch(/progressStore\.set\(/);
      expect(text, f).not.toMatch(/recentGamesCache/);
      expect(text, f).not.toMatch(/loadCachedGames/);
    }
  });
});
