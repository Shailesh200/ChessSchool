import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// (k) beginSession() decides on the real previous user. During the cold-start read of the
// saved last user id it used to decide on "unknown": no new generation, so an edit queued
// as A ran after B signed in and was pushed into B's account (probe Pe). Now the decision
// waits for the id, only the latest sign-in applies, queued edits remember whether a token
// was present when they were queued, and the sync entry points wait for the decision.
// A cold start here is a fresh module (boot()) whose read of the saved id is held open.

const GUEST = "chessschool.guestProgress";
const GAMES = "chessschool.recentGamesCache";
const LAST_USER = "chessschool.lastUserId";
const settle = (ms = 20) => new Promise((r) => setTimeout(r, ms));
const disk = vi.hoisted(() => new Map<string, string>());
const secure = vi.hoisted(() => ({
  setItemAsync: vi.fn(async (k: string, v: string) => void disk.set(k, v)),
  getItemAsync: vi.fn(async (k: string) => disk.get(k) ?? null),
  deleteItemAsync: vi.fn(async (k: string) => void disk.delete(k)),
}));
const tokenBox = vi.hoisted(() => ({ token: "token" as string | null }));
const settingsBox = vi.hoisted(() => ({ hydrate: vi.fn() }));

/** The settings module, whose dynamic import a test can hold open until `held` resolves. */
async function mockSettings(held: Promise<void> = Promise.resolve()) {
  vi.doUnmock("./settings");
  vi.doMock("./settings", async () => {
    await held;
    return { hydrateSettings: settingsBox.hydrate, loadSettingsFromAccount: vi.fn() };
  });
  await settle(1);
}
vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => secure);
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
  return { ...store, apiMock: vi.mocked(apiMod.api), ApiError: apiMod.ApiError };
}
type Boot = Awaited<ReturnType<typeof boot>>;
const posts = (b: Boot) =>
  b.apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === "POST");
const postedXp = (b: Boot) =>
  posts(b).map(([, o]) => (o as { body: { xp?: number } }).body.xp);
const gets = (b: Boot) =>
  b.apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method !== "POST");
const account = (id: string, extra: Record<string, unknown> = {}) => ({
  user: { id },
  xp: 0,
  lessons: {},
  rating: 800,
  ...extra,
});
const gate = () => {
  let release: () => void = () => undefined;
  const p = new Promise<void>((r) => (release = r));
  return { p, release };
};
const stored = (k: string) => (disk.has(k) ? JSON.parse(disk.get(k) as string) : null);
const wrote = (key: string, value?: string) =>
  secure.setItemAsync.mock.calls.some(
    ([k, v]) => k === key && (value === undefined || v === value),
  );

/** Cold start: the saved last user id (null: none) is read, but the read is held open. */
async function coldStart(saved: string | null, token: string | null = "token-A") {
  tokenBox.token = token;
  if (saved) disk.set(LAST_USER, saved);
  const idGate = gate();
  secure.getItemAsync.mockImplementation(async (k: string) => {
    if (k === LAST_USER) await idGate.p;
    return disk.get(k) ?? null;
  });
  const b = await boot();
  return { b, release: idGate.release };
}
/** A's first push gets the 401 (the api layer clears the token and expires); the rest succeed. */
function aGets401ThenAccountsAnswer(b: Boot, accounts: Record<string, unknown>) {
  let first = true;
  b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) => {
    if (opts?.method === "POST") {
      if (first) {
        first = false;
        tokenBox.token = null;
        b.progressStore.expire();
        throw new b.ApiError(401, "unauthorized");
      }
      return { ok: true, count: 1 };
    }
    return accounts[tokenBox.token ?? ""] ?? account("nobody");
  }) as never);
}
const accounts = {
  "token-A": account("A"),
  "token-B": account("B"),
  "token-C": account("C"),
};

beforeEach(async () => {
  disk.clear();
  tokenBox.token = "token";
  await mockSettings();
  settingsBox.hydrate.mockReset();
  secure.getItemAsync.mockImplementation(async (k: string) => disk.get(k) ?? null);
  secure.setItemAsync.mockClear();
  secure.setItemAsync.mockImplementation(
    async (k: string, v: string) => void disk.set(k, v),
  );
});

describe("(k) probe Pe: A's queued edit never reaches B when B signs in during the id load", () => {
  /** A's edit 1 gets the 401 and waits for the id; edit 2 was queued behind it as A. */
  async function pe(saved: string | null) {
    const { b, release } = await coldStart(saved);
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    aGets401ThenAccountsAnswer(b, accounts);
    const e1 = b.mutateProgress((s) => ({ ...s, xp: 700 }));
    const e2 = b.mutateProgress((s) => ({ ...s, xp: 999 }));
    await settle(10); // the 401 has landed; the saved id is still being read
    tokenBox.token = "token-B"; // B signs in: the token first, then beginSession (auth.tsx)
    b.progressStore.beginSession("B");
    b.apiMock.mockClear();
    const sync = b.syncProgressAfterAuth();
    release();
    const out = await sync;
    await Promise.all([e1, e2]);
    await settle(60);
    return { b, out };
  }

  it.each([
    ["the saved id is empty (the previous user is unknown)", null],
    ["the saved id says A (the previous user is A)", "A"],
  ])("%s: 999 xp never reaches B", async (_n, saved) => {
    const { b, out } = await pe(saved);
    expect(out.merged).toBe(false);
    expect(postedXp(b)).not.toContain(999);
    expect(postedXp(b)).not.toContain(700);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
    expect(JSON.stringify(stored(GUEST))).not.toMatch(/999|"B"/);
    expect(disk.get(LAST_USER)).toBe("B");
  });
});

describe("(k) a real guest's queued edit still merges when B signs in", () => {
  it("queued as a guest behind another guest edit, B signs in during the id load: the edit is B's first push", async () => {
    const { b, release } = await coldStart(null, null);
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? { ok: true, count: 1 } : account("B")) as never);
    // the first guest edit is held at its disk read; the second waits behind it
    const held = gate();
    secure.getItemAsync.mockImplementation(async (k: string) => {
      if (k === LAST_USER) await held.p;
      if (k === GUEST) await held.p;
      return disk.get(k) ?? null;
    });
    const e1 = b.mutateProgress((s) => ({ ...s, xp: 5 })); // no token: a guest's
    const e2 = b.mutateProgress((s) => ({ ...s, xp: (s.xp as number) + 1 }));
    await settle(10);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    held.release();
    release();
    await Promise.all([e1, e2]);
    await settle(60);
    expect(postedXp(b)).toContain(6); // both guest edits were kept and pushed for B
    expect((b.progressStore.get() as { xp: number }).xp).toBe(6);
  });

  it("the guest's copy on disk merges into B's empty account", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 5, lessons: {} }));
    const { b, release } = await coldStart(null, null);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? { ok: true, count: 1 } : account("B")) as never);
    const sync = b.syncProgressAfterAuth();
    release();
    expect((await sync).merged).toBe(true);
    expect(postedXp(b)).toContain(5);
  });
});

describe("(k) the same user signing in again during the id load keeps their own edits", () => {
  it("A's queued edits run as A: nothing dropped (the saved id says A)", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? { ok: true, count: 1 } : account("A")) as never);
    const e1 = b.mutateProgress((s) => ({ ...s, xp: 50 }));
    const e2 = b.mutateProgress((s) => ({ ...s, xp: 60 }));
    await settle(10);
    b.progressStore.beginSession("A"); // A signs in again while the id loads
    release();
    await Promise.all([e1, e2]);
    await settle(60);
    expect(postedXp(b)).toEqual([50, 60]);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(60);
    expect(disk.get(LAST_USER)).toBe("A");
  });

  it("Pa: A's 401 is waiting for the id and A signs back in: the edit is KEPT, tagged A", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    aGets401ThenAccountsAnswer(b, accounts);
    const e1 = b.mutateProgress((s) => ({ ...s, xp: 700 }));
    const e2 = b.mutateProgress((s) => ({ ...s, xp: 999 }));
    await settle(10);
    tokenBox.token = "token-A"; // A signs back in
    b.progressStore.beginSession("A");
    release();
    await Promise.all([e1, e2]);
    await settle(60);
    // edit 1 was kept as A's copy (and in the cache); edit 2 ran as A and was pushed to A
    expect(stored(GUEST)).toMatchObject({
      origin: "signed-in",
      owner: "A",
      snap: { xp: 700 },
    });
    expect(postedXp(b)).toContain(999);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(999);
  });

  it("Pa when the previous user is unknown (no saved id): fails closed, A's edits are dropped, nothing is pushed", async () => {
    const { b, release } = await coldStart(null);
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    aGets401ThenAccountsAnswer(b, accounts);
    const e1 = b.mutateProgress((s) => ({ ...s, xp: 700 }));
    const e2 = b.mutateProgress((s) => ({ ...s, xp: 999 }));
    await settle(10);
    tokenBox.token = "token-A";
    b.progressStore.beginSession("A");
    release();
    await Promise.all([e1, e2]);
    await settle(60);
    expect(postedXp(b)).not.toContain(999);
    expect(disk.has(GUEST)).toBe(false);
    expect(disk.get(LAST_USER)).toBe("A");
  });

  it("an edit queued after the sign-in call is the new user's own and is not dropped", async () => {
    const { b, release } = await coldStart(null);
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? { ok: true, count: 1 } : account("B")) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const own = b.mutateProgress((s) => ({ ...s, xp: 33 })); // B's, queued after the call
    release();
    await own;
    expect(postedXp(b)).toContain(33);
  });
});

describe("(k) a second sign-in while the first still waits: only the latest wins", () => {
  it("B then C: B writes nothing, C's session and C's cached games stay", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST" ? { ok: true, count: 1 } : account("C")) as never);
    // C's own cache (a pull of C's), in place by the time the sign-ins arrive
    disk.set(
      GAMES,
      JSON.stringify({
        chessGames: 2,
        origin: "signed-in",
        owner: "C",
        games: [{ id: "c1" }],
      }),
    );
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    tokenBox.token = "token-C";
    b.progressStore.beginSession("C");
    release();
    await settle(60);
    expect(wrote(LAST_USER, "B")).toBe(false);
    expect(disk.get(LAST_USER)).toBe("C");
    expect(stored(GAMES)?.owner).toBe("C"); // B's application would have deleted it
    expect(b.progressStore.get()).toBeNull();
  });

  it("B's own sync, started before C signed in, ends up on C's session and writes no B state", async () => {
    const { b, release } = await coldStart("A");
    b.apiMock.mockImplementation((async () => account("C", { xp: 7 })) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const bSync = b.fetchProgress(true); // B's continuation
    tokenBox.token = "token-C";
    b.progressStore.beginSession("C");
    release();
    await bSync;
    await settle(60);
    expect(wrote(LAST_USER, "B")).toBe(false);
    expect(disk.get(LAST_USER)).toBe("C");
    expect((b.progressStore.get() as { user: { id: string } }).user.id).toBe("C");
  });

  it("a logout while the first waits voids it: no id is saved for it", async () => {
    const { b, release } = await coldStart("A");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    tokenBox.token = null;
    b.progressStore.clear(); // logout in the window
    release();
    await settle(60);
    expect(wrote(LAST_USER, "B")).toBe(false);
    expect(disk.has(LAST_USER)).toBe(false);
  });
});

describe("(k) whatever runs after beginSession() sees the decided session", () => {
  it("fetchProgress sends no request before the saved id is known, then pulls as the new user", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async () => account("B")) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const pull = b.fetchProgress(true);
    await settle(20);
    expect(b.apiMock).not.toHaveBeenCalled(); // held back by the pending sign-in
    release();
    await pull;
    expect((b.progressStore.get() as { user: { id: string } }).user.id).toBe("B");
    expect(gets(b)).toHaveLength(1);
  });

  it("fetchProgress() with a cache does not hand A's cached progress to B", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async () => account("B", { xp: 3 })) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const pull = b.fetchProgress(); // not forced: used to return the cache at once
    release();
    const got = (await pull) as { user: { id: string } };
    expect(got.user.id).toBe("B");
    expect(gets(b)).toHaveLength(1);
  });

  it("an edit queued after B's sign-in call starts from B's account, not from A's cached progress", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST"
        ? { ok: true, count: 1 }
        : account("B", { xp: 3 })) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const edit = b.mutateProgress((s) => ({ ...s, xp: (s.xp as number) + 1 }));
    release();
    await edit;
    await settle(40);
    expect(postedXp(b)).toEqual([4]); // B's 3 + 1; never A's 10 + 1
    expect(postedXp(b)).not.toContain(11);
  });

  it("B's edit, queued after B's call, is not sent as C when C signs in before the id is known", async () => {
    const { b, release } = await coldStart("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) =>
      opts?.method === "POST"
        ? { ok: true, count: 1 }
        : account("C", { xp: 3 })) as never);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const edit = b.mutateProgress((s) => ({ ...s, xp: (s.xp as number) + 1 }));
    tokenBox.token = "token-C";
    b.progressStore.beginSession("C");
    release();
    await edit;
    await settle(40);
    expect(posts(b)).toHaveLength(0);
  });

  it("the cached games read waits too: A's games are not shown to B", async () => {
    disk.set(
      GAMES,
      JSON.stringify({
        chessGames: 2,
        origin: "signed-in",
        owner: "A",
        games: [{ id: "a1" }],
      }),
    );
    const { b, release } = await coldStart("A");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    const read = b.progressStore.loadCachedGames();
    release();
    expect(await read).toBeNull();
    await settle(20);
    expect(disk.has(GAMES)).toBe(false);
  });

  it("source: the five sign-in calls in auth.tsx stay fire-and-forget and need no await", () => {
    const src = readFileSync(join(__dirname, "auth.tsx"), "utf8");
    expect(src.match(/progressStore\.beginSession\(user\.id\);/g)).toHaveLength(5);
    expect(src).not.toMatch(/await\s+progressStore\.beginSession/);
  });
});

describe("(k) the settings of the account are not applied after a logout during the import", () => {
  const accountWithSettings = account("A", { settings: { theme: "dark" } });

  it("control: a pull applies the account's settings", async () => {
    tokenBox.token = "token-A";
    const b = await boot();
    b.apiMock.mockImplementation((async () => accountWithSettings) as never);
    await b.fetchProgress(true);
    expect(settingsBox.hydrate).toHaveBeenCalledTimes(1);
  });

  it("a logout while the settings module loads: hydrateSettings is not called with A's settings", async () => {
    tokenBox.token = "token-A";
    const held = gate();
    await mockSettings(held.p);
    const b = await boot();
    b.apiMock.mockImplementation((async () => accountWithSettings) as never);
    const pull = b.fetchProgress(true);
    await settle(20); // the reply arrived; the import is held
    b.progressStore.clear();
    held.release();
    await pull;
    await settle(20);
    expect(settingsBox.hydrate).not.toHaveBeenCalled();
  });

  it("another user signing in during the import: A's settings are not applied either", async () => {
    tokenBox.token = "token-A";
    const held = gate();
    await mockSettings(held.p);
    const b = await boot();
    b.progressStore.beginSession("A");
    await settle(30); // A's sign-in is decided (the saved id read is not held here)
    b.apiMock.mockImplementation((async () => accountWithSettings) as never);
    const pull = b.fetchProgress(true);
    await settle(20);
    b.progressStore.beginSession("B");
    held.release();
    await pull;
    await settle(20);
    expect(settingsBox.hydrate).not.toHaveBeenCalled();
  });
});

// (k) An edit whose request is already out when the session changes. The reply is the
// sender's: it is applied only if nothing about the session moved since the request was
// sent (the generation, and whether a user had been learned). With no saved previous user
// the generation does not move on B's sign-in, so "a user was learned meanwhile" is what
// tells A's reply from B's session.
describe("(k) an edit in flight when another user signs in", () => {
  const A_GAMES = [{ id: "game-of-A" }];
  /** A's edit (with a game) is sent and its reply is held: `reply()` lets it arrive. */
  async function inFlight(
    saved: string | null,
    outcome: "ok" | "401" = "ok",
    coldRead = false,
    signedInThisRun = false,
  ) {
    tokenBox.token = "token-A";
    if (saved) disk.set(LAST_USER, saved);
    const idGate = gate();
    if (coldRead)
      secure.getItemAsync.mockImplementation(async (k: string) => {
        if (k === LAST_USER) await idGate.p;
        return disk.get(k) ?? null;
      });
    const b = await boot();
    if (!coldRead) await settle(20); // the saved id is read
    if (signedInThisRun) {
      b.progressStore.beginSession("A"); // A signed in during this run: the user is known
      await settle(10);
    }
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    const answer = gate();
    b.apiMock.mockImplementation((async (_p: string, opts?: { method?: string }) => {
      if (opts?.method === "POST") {
        await answer.p;
        if (outcome === "401") {
          tokenBox.token = null;
          throw new b.ApiError(401, "unauthorized");
        }
        return { ok: true, count: 1 };
      }
      return (
        (accounts as Record<string, unknown>)[tokenBox.token ?? ""] ?? account("nobody")
      );
    }) as never);
    const edit = b.mutateProgress((s) => ({ ...s, xp: 700, recentGames: A_GAMES }));
    await settle(20); // the request is out
    expect(posts(b)).toHaveLength(1);
    return {
      b,
      edit,
      releaseId: idGate.release,
      answerNow: answer.release,
      reply: async () => {
        answer.release();
        await edit;
        await settle(40);
      },
    };
  }
  const xpOf = (b: Boot) => (b.progressStore.get() as { xp: number } | null)?.xp;
  const userOf = (b: Boot) =>
    (b.progressStore.get() as { user: { id: string } } | null)?.user.id;

  it("no saved previous user: B signs in while A's edit is in flight, A's reply never reaches B's cache or UI", async () => {
    const { b, reply } = await inFlight(null);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle(10);
    await b.fetchProgress(true); // B's account is on screen
    expect(userOf(b)).toBe("B");
    const seen = vi.fn();
    b.progressStore.subscribe(seen);
    await reply(); // A's reply arrives now
    expect(userOf(b)).toBe("B");
    expect(xpOf(b)).toBe(0);
    expect(seen).not.toHaveBeenCalled();
    expect(posts(b)).toHaveLength(1); // A's own request only: nothing sent as B
    expect(disk.has(GAMES) ? JSON.stringify(stored(GAMES)) : "").not.toMatch(
      /game-of-A/,
    );
    expect(JSON.stringify(stored(GUEST))).not.toMatch(/700|game-of-A/);
  });

  it("no saved previous user, A's request fails with a 401 after B signed in: nothing is kept or tagged for B", async () => {
    const { b, reply } = await inFlight(null, "401");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle(10);
    await b.fetchProgress(true);
    await reply();
    expect(userOf(b)).toBe("B");
    expect(xpOf(b)).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("the saved id says A: B signs in while A's edit is in flight, A's reply is dropped too", async () => {
    const { b, reply } = await inFlight("A");
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle(10);
    await b.fetchProgress(true);
    const seen = vi.fn();
    b.progressStore.subscribe(seen);
    await reply();
    expect(userOf(b)).toBe("B");
    expect(xpOf(b)).toBe(0);
    expect(seen).not.toHaveBeenCalled();
  });

  it("the sign-in is still waiting for the saved id when A's reply arrives: it is dropped once B is decided", async () => {
    const { b, edit, releaseId, answerNow } = await inFlight(null, "ok", true);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B"); // deferred: the saved id is still being read
    answerNow(); // A's reply arrives before B is decided
    await settle(10);
    releaseId();
    await edit;
    await settle(10);
    // A's reply waited for the decision, which then dropped it: nothing of it is in the
    // cache before B's own pull (the cache still holds what it held when A's edit began)
    expect(xpOf(b)).not.toBe(700);
    expect(disk.has(GAMES)).toBe(false);
    await b.fetchProgress(true);
    expect(userOf(b)).toBe("B");
    expect(xpOf(b)).toBe(0);
    expect(posts(b)).toHaveLength(1);
  });

  it("G4: B's sync after A's late reply posts nothing of A's edit in B's name", async () => {
    const { b, reply } = await inFlight(null);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle(10);
    await reply(); // A's reply lands before B's sync starts
    await b.syncProgressAfterAuth();
    await settle(20);
    const toB = posts(b).slice(1); // after A's own request
    expect(JSON.stringify(toB)).not.toMatch(/game-of-A|"xp":700/);
    expect(JSON.stringify(b.progressStore.get())).not.toMatch(/game-of-A|"xp":700/);
  });

  it("A signed in earlier in this run (the user is known): B signs in during the flight, A's reply is dropped by the generation", async () => {
    const { b, reply } = await inFlight(null, "ok", false, true);
    tokenBox.token = "token-B";
    b.progressStore.beginSession("B");
    await settle(10);
    await b.fetchProgress(true);
    const seen = vi.fn();
    b.progressStore.subscribe(seen);
    await reply();
    expect(userOf(b)).toBe("B");
    expect(xpOf(b)).toBe(0);
    expect(seen).not.toHaveBeenCalled();
  });

  it("401 backstop: an edit sent after a first logout, 401 while the saved id still loads, a second logout in the wait: the edit is not kept", async () => {
    // The user was already known when the edit was sent (the first logout flipped
    // lastUserTouched), so the 'user learned' arm cannot fire: only the generation arm
    // stops the old edit from being kept after the second logout.
    const { b, release } = await coldStart("A");
    b.progressStore.clear(); // logout 1: lastUserTouched, the generation moves
    tokenBox.token = "token-X"; // a token for the next edit (a sign-in being set up)
    let reject: (e: unknown) => void = () => undefined;
    const held = new Promise((_, r) => (reject = r));
    b.apiMock.mockImplementation((async (_p: string, o?: { method?: string }) =>
      o?.method === "POST" ? held : account("X")) as never);
    const edit = b.mutateProgress((s) => ({
      ...s,
      xp: 222,
      lessons: { "x-secret": { mastery: 4 } },
    }));
    await settle(10);
    expect(posts(b)).toHaveLength(1); // on the wire
    reject(new b.ApiError(401, "unauthorized")); // the branch now waits for the saved id
    await settle(10);
    b.progressStore.clear(); // logout 2, inside the wait: the generation moves again
    tokenBox.token = null;
    release();
    await edit.catch(() => void 0);
    await settle();
    expect(JSON.stringify(b.progressStore.get() ?? null)).not.toContain("x-secret");
    expect(disk.get(GUEST) ?? "").not.toContain("x-secret");
  });

  it("control: nobody signs in, A's reply for A applies", async () => {
    const { b, reply } = await inFlight(null);
    const seen = vi.fn();
    b.progressStore.subscribe(seen);
    await reply();
    expect(xpOf(b)).toBe(700);
    expect(userOf(b)).toBe("A");
    expect(seen).toHaveBeenCalled();
    expect(stored(GAMES)).toMatchObject({ games: A_GAMES });
  });

  it("control: the saved id says A and A signs in again meanwhile: A's reply for A still applies", async () => {
    const { b, reply } = await inFlight("A");
    b.progressStore.beginSession("A");
    await settle(10);
    await reply();
    expect(xpOf(b)).toBe(700);
    expect(userOf(b)).toBe("A");
  });
});
