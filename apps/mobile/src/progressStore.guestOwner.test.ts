import { beforeEach, describe, expect, it, vi } from "vitest";

// A session expiry keeps the in-flight edit as guest progress. That copy is tagged
// with the user who expired: it merges only for that user. A different user signing
// in does not get it. A plain guest copy (no tag) merges as before.

const GUEST = "chessschool.guestProgress";
const OWNER = "chessschool.guestProgressOwner";
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

import { api } from "./api";
import { mutateProgress, progressStore, syncProgressAfterAuth } from "./progressStore";

const apiMock = vi.mocked(api);
const posts = () =>
  apiMock.mock.calls.filter(([, o]) => (o as { method?: string })?.method === "POST");
const emptyAccount = (id: string) => ({
  user: { id },
  xp: 0,
  lessons: {},
  rating: 800,
});

/** A signs in, edits, and the push gets the 401 (the api layer clears the token and calls expire()). */
async function expireAsA() {
  progressStore.beginSession("A");
  progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
  const { ApiError } = await import("./api");
  apiMock.mockImplementationOnce((async () => {
    tokenBox.token = null;
    progressStore.expire();
    throw new ApiError(401, "unauthorized");
  }) as never);
  await mutateProgress((s) => ({ ...s, xp: 600 }));
  apiMock.mockReset();
}

/** The next sign-in: server GET returns the account, the merge push is acknowledged. */
function signInWith(account: Record<string, unknown>) {
  tokenBox.token = "token-next";
  apiMock.mockImplementation(((_p: string, opts?: { method?: string }) =>
    Promise.resolve(
      opts?.method === "POST" ? { ok: true, count: 1 } : account,
    )) as never);
}

beforeEach(() => {
  apiMock.mockReset();
  disk.clear();
  tokenBox.token = "token";
  progressStore.clear();
});

describe("expire()", () => {
  it("empties the cache (a guest browsing after the expiry does not see the old user's snapshot)", () => {
    progressStore.set({ user: { id: "A" }, xp: 10, lessons: {} });
    expect(progressStore.get()).not.toBeNull();
    progressStore.expire();
    expect(progressStore.get()).toBeNull();
  });
});

describe("guest copy kept after a session expiry is tagged with its owner", () => {
  it("tags the kept copy with the user whose session expired", async () => {
    await expireAsA();
    expect(disk.get(OWNER)).toBe("A");
    expect(disk.get(GUEST)).toContain('"xp":600');
  });

  it("B signing in on the device after A's 401 gets none of A's progress, and the copy is dropped", async () => {
    await expireAsA();
    progressStore.clear(); // app restart: no in-memory state, only the stored copy
    progressStore.beginSession("B");
    signInWith(emptyAccount("B"));

    const out = await syncProgressAfterAuth();

    expect(out.merged).toBe(false);
    expect(posts()).toHaveLength(0);
    expect((progressStore.get() as { xp: number }).xp).toBe(0);
    expect(disk.has(GUEST)).toBe(false);
    expect(disk.has(OWNER)).toBe(false);
  });

  it("B signing in without a restart (A's edit still in memory) gets none of A's progress either", async () => {
    await expireAsA();
    progressStore.beginSession("B");
    signInWith(emptyAccount("B"));

    const out = await syncProgressAfterAuth();

    expect(out.merged).toBe(false);
    expect(posts()).toHaveLength(0);
    expect(disk.has(GUEST)).toBe(false);
  });

  it("A signing in again after the 401 gets their own progress back", async () => {
    await expireAsA();
    progressStore.clear();
    progressStore.beginSession("A");
    signInWith(emptyAccount("A"));

    const out = await syncProgressAfterAuth();

    expect(out.merged).toBe(true);
    expect(posts()).toHaveLength(1);
    expect((posts()[0][1] as { body: { xp: number } }).body.xp).toBe(600);
    expect(disk.has(GUEST)).toBe(false);
    expect(disk.has(OWNER)).toBe(false);
  });

  it("an untagged guest copy (never signed in) still merges into the account that signs in", async () => {
    disk.set(GUEST, JSON.stringify({ xp: 40, lessons: {} }));
    progressStore.beginSession("B");
    signInWith(emptyAccount("B"));

    const out = await syncProgressAfterAuth();

    expect(out.merged).toBe(true);
    expect(posts()).toHaveLength(1);
    expect((posts()[0][1] as { body: { xp: number } }).body.xp).toBe(40);
  });

  it("a guest edit made after the expiry keeps the tag", async () => {
    await expireAsA();
    progressStore.clear();
    tokenBox.token = null;
    await mutateProgress((s) => ({ ...s, xp: 650 }));
    expect(disk.get(GUEST)).toContain('"xp":650');
    expect(disk.get(OWNER)).toBe("A");
  });
});
