import { beforeEach, describe, expect, it, vi } from "vitest";

// The bleed P0 on mobile: the journal and the saved games live inside the progress snapshot
// (journalEntries, recentGames), so they are covered by the same owner and generation guards
// as xp: a copy kept after A's session expiry merges only for A (guest-copy owner tag), an
// explicit logout drops it, and a later sign-in as B starts from B's own account. These pins
// follow A's journal and games specifically, which the xp-based tests do not look at.

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

const jA = [{ id: "jA1", date: "2026-10-29", title: "A's reflection", confidence: 3 }];
const gA = [{ id: "gA1", result: "win", by: "A" }];
const jB = [{ id: "jB1", date: "2026-10-30", title: "B's reflection", confidence: 4 }];
const gB = [{ id: "gB1", result: "loss", by: "B" }];
const idsOf = (v: unknown) =>
  ((v as Array<{ id: string }> | undefined) ?? []).map((x) => x.id);
const bAccount = (extra: Record<string, unknown> = {}) => ({
  ...emptyAccount("B"),
  ...extra,
});
const everythingPosted = (b: Boot) =>
  JSON.stringify(posts(b).map(([, o]) => (o as { body: unknown }).body));

/** A signs in with a journal and games, edits, and the push gets the 401. */
async function expireAsAWithJournal(b: Boot) {
  b.progressStore.beginSession("A");
  b.progressStore.set({
    user: { id: "A" },
    xp: 10,
    lessons: {},
    journalEntries: jA,
    recentGames: gA,
  });
  expireOnNextPush(b);
  await b.mutateProgress((s) => ({ ...s, xp: 600 }));
  b.apiMock.mockReset();
}

describe("A's journal and games do not reach B (mobile)", () => {
  it("after A's 401 and an app restart, B's cache and pushes hold none of them", async () => {
    await expireAsAWithJournal(await boot());
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, bAccount({ journalEntries: jB, recentGames: gB }));
    await b.syncProgressAfterAuth();
    const snap = b.progressStore.get() as Record<string, unknown>;
    expect(idsOf(snap.journalEntries)).not.toContain("jA1");
    expect(idsOf(snap.recentGames)).not.toContain("gA1");
    expect(everythingPosted(b)).not.toMatch(/jA1|gA1/);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("after A's 401 with no restart, an empty B account gets none of them", async () => {
    const b = await boot();
    await expireAsAWithJournal(b);
    b.progressStore.beginSession("B");
    signInWith(b, bAccount());
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    const snap = b.progressStore.get() as Record<string, unknown>;
    expect(idsOf(snap.journalEntries)).toEqual([]);
    expect(idsOf(snap.recentGames)).toEqual([]);
  });

  it("after A logs out explicitly, B starts clean", async () => {
    const b = await boot();
    await expireAsAWithJournal(b);
    b.progressStore.clear(); // explicit logout
    await settle();
    expect(disk.has(GUEST)).toBe(false);
    b.progressStore.beginSession("B");
    signInWith(b, bAccount());
    await b.syncProgressAfterAuth();
    expect(posts(b)).toHaveLength(0);
    const snap = (b.progressStore.get() ?? {}) as Record<string, unknown>;
    expect(idsOf(snap.journalEntries)).toEqual([]);
    expect(idsOf(snap.recentGames)).toEqual([]);
  });

  it("control: A signing in again (their account holds the journal and games) keeps them", async () => {
    await expireAsAWithJournal(await boot());
    const b = await boot();
    b.progressStore.beginSession("A");
    signInWith(b, {
      ...emptyAccount("A"),
      xp: 700,
      journalEntries: jA,
      recentGames: gA,
    });
    await b.syncProgressAfterAuth();
    const snap = b.progressStore.get() as Record<string, unknown>;
    expect(idsOf(snap.journalEntries)).toEqual(["jA1"]);
    expect(idsOf(snap.recentGames)).toEqual(["gA1"]);
  });
});
