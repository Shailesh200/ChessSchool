import { beforeEach, describe, expect, it, vi } from "vitest";

// A guest copy tagged `chessGuest: 2` whose `snap` is missing or not a plain object is
// damaged. It is dropped (removed from storage) and read as nothing. It is never read as
// an older plain copy, which would merge the whole envelope into whoever signs in. Older
// plain copies (no `chessGuest` field) behave as before.

const GUEST = "chessschool.guestProgress";
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

const SHAPES: Array<[string, Record<string, unknown>]> = [
  ["a string", { snap: "garbage" }],
  ["null", { snap: null }],
  ["an array", { snap: [1, 2, { xp: 99 }] }],
  ["a number", { snap: 7 }],
  ["a boolean", { snap: true }],
  ["missing", {}],
  ["missing, with xp 99 at the top level", { xp: 99, lessons: { l1: { mastery: 1 } } }],
  ["an empty string", { snap: "" }],
];
const ORIGINS: Array<[string, Record<string, unknown>]> = [
  ["signed-in, owner A", { origin: "signed-in", owner: "A" }],
  ["guest", { origin: "guest", owner: null }],
  ["no origin", {}],
];

describe("(j) a damaged chessGuest:2 copy is dropped and never merged", () => {
  for (const [shapeName, shape] of SHAPES) {
    for (const [originName, tag] of ORIGINS) {
      it(`snap ${shapeName} (${originName}): B signs in, nothing merges, nothing is pushed, the copy is removed`, async () => {
        disk.set(GUEST, JSON.stringify({ chessGuest: 2, ...tag, ...shape }));
        const b = await boot();
        b.progressStore.beginSession("B");
        signInWith(b, emptyAccount("B"));
        b.apiMock.mockClear();
        const out = await b.syncProgressAfterAuth();
        expect(out.merged).toBe(false);
        expect(posts(b)).toHaveLength(0);
        expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
        expect((b.progressStore.get() as { lessons: object }).lessons).toEqual({});
        expect(disk.has(GUEST)).toBe(false);
      });
    }
  }

  it("a signed-out guest browsing reads nothing from it and the copy is removed", async () => {
    disk.set(
      GUEST,
      JSON.stringify({ chessGuest: 2, origin: "signed-in", owner: "A", xp: 99 }),
    );
    tokenBox.token = null;
    const b = await boot();
    expect(await b.fetchProgress(true)).toBeNull();
    expect(disk.has(GUEST)).toBe(false);
  });

  it("a guest edit does not build on it, and the new copy is a clean guest copy", async () => {
    disk.set(
      GUEST,
      JSON.stringify({ chessGuest: 2, origin: "signed-in", owner: "A", xp: 99 }),
    );
    tokenBox.token = null;
    const b = await boot();
    await b.mutateProgress((s) => ({ ...s, xp: 5 }));
    const v = JSON.parse(disk.get(GUEST) as string) as Record<string, unknown>;
    expect(v).toMatchObject({
      chessGuest: 2,
      origin: "guest",
      owner: null,
      snap: { xp: 5 },
    });
  });

  it("a signed-in 401 keeps its edit as before (a damaged copy does not block a new one)", async () => {
    disk.set(GUEST, JSON.stringify({ chessGuest: 2, snap: "garbage" }));
    const b = await boot();
    b.progressStore.beginSession("A");
    b.progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    b.apiMock.mockImplementationOnce((async () => {
      tokenBox.token = null;
      b.progressStore.expire();
      throw new (await import("./api")).ApiError(401, "unauthorized");
    }) as never);
    await b.mutateProgress((s) => ({ ...s, xp: 600 }));
    expect(JSON.parse(disk.get(GUEST) as string)).toMatchObject({
      chessGuest: 2,
      origin: "signed-in",
      owner: "A",
      snap: { xp: 600 },
    });
  });
});

describe("(j) what still reads as before", () => {
  it("an older plain copy (no chessGuest field) merges into the account that signs in", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 99, lessons: {}, streak: 1 }));
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    const out = await b.syncProgressAfterAuth();
    expect(out.merged).toBe(true);
    expect(posts(b)).toHaveLength(1);
    expect((posts(b)[0][1] as { body: { xp: number } }).body.xp).toBe(99);
  });

  it("a well-formed tagged copy still merges for its owner and an empty-object snapshot is not damaged", async () => {
    disk.set(
      GUEST,
      JSON.stringify({ chessGuest: 2, origin: "guest", owner: null, snap: { xp: 40 } }),
    );
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    expect((await b.syncProgressAfterAuth()).merged).toBe(true);
    disk.set(
      GUEST,
      JSON.stringify({ chessGuest: 2, origin: "guest", owner: null, snap: {} }),
    );
    const c = await boot();
    c.progressStore.beginSession("B");
    signInWith(c, emptyAccount("B"));
    expect((await c.syncProgressAfterAuth()).merged).toBe(false);
    expect(posts(c)).toHaveLength(0);
  });

  it("a copy from another envelope version is never merged (and is not removed: we cannot tell whose it is)", async () => {
    const v = { chessGuest: 3, origin: "guest", owner: null, snap: { xp: 99 }, xp: 99 };
    disk.set(GUEST, JSON.stringify(v));
    const b = await boot();
    b.progressStore.beginSession("B");
    signInWith(b, emptyAccount("B"));
    expect((await b.syncProgressAfterAuth()).merged).toBe(false);
    expect(posts(b)).toHaveLength(0);
    expect((b.progressStore.get() as { xp: number }).xp).toBe(0);
  });

  it("a signed-out guest browsing with a stored JSON array gets nothing from it", async () => {
    disk.set(GUEST, "[1,2]");
    tokenBox.token = null;
    const b = await boot();
    expect(await b.fetchProgress(true)).toBeNull();
  });

  it("a stored JSON array, null or unparseable text reads as nothing", async () => {
    for (const raw of ["[1,2]", "null", "{oops", '"text"']) {
      disk.set(GUEST, raw);
      const b = await boot();
      b.progressStore.beginSession("B");
      signInWith(b, emptyAccount("B"));
      expect((await b.syncProgressAfterAuth()).merged).toBe(false);
      expect(posts(b)).toHaveLength(0);
    }
  });
});
