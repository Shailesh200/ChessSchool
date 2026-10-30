import { beforeEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});

const store = vi.hoisted(() => new Map<string, string>());

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async (k: string) => store.get(k) ?? null),
  setItemAsync: vi.fn(async (k: string, v: string) => void store.set(k, v)),
  deleteItemAsync: vi.fn(async (k: string) => void store.delete(k)),
}));
const wipeUserData = vi.hoisted(() => vi.fn(async (_opts?: { expired?: boolean }) => {}));
vi.mock("./wipeUserData", () => ({ wipeUserData }));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

import { clearToken, getToken, setToken, setUnauthorizedHandler } from "./api";
import { bootFromSavedToken, forgetUser, rememberUser, revalidateSession } from "./authBoot";

const TOKEN = "tok-0123456789abcdef0123456789abcdef";
const USER = { id: "u1", name: "Maya", email: "maya@example.com", role: "student" };

function json(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();

beforeEach(async () => {
  store.clear();
  wipeUserData.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  setUnauthorizedHandler(null);
  await setToken(TOKEN);
  await rememberUser(USER, TOKEN); // a previous online session stored who this token is
});

describe("DP-M-005 cold start keeps the session unless the server says 401", () => {
  it("offline: a network error keeps the token and boots as the cached user", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    const outcome = await bootFromSavedToken();
    expect(outcome).toEqual({ kind: "offline", user: USER });
    expect(await getToken()).toBe(TOKEN);
  });

  it("server error: HTTP 500 keeps the token and boots as the cached user", async () => {
    fetchMock.mockResolvedValue(json(500, { error: "boom" }));
    const outcome = await bootFromSavedToken();
    expect(outcome).toEqual({ kind: "offline", user: USER });
    expect(await getToken()).toBe(TOKEN);
  });

  it("401: the token is cleared, the handler runs and the cached user is dropped", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));
    const outcome = await bootFromSavedToken();
    expect(outcome).toEqual({ kind: "rejected" });
    expect(await getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(store.has("chessschool.lastUser")).toBe(false);
  });

  it("offline boot, then back online and /me returns 401: token cleared and the expiry handler runs", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);

    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "offline", user: USER });
    expect(await getToken()).toBe(TOKEN);
    expect(onUnauthorized).not.toHaveBeenCalled();

    // Still offline: the re-check keeps the session and does not fire the handler.
    expect(await revalidateSession()).toEqual({ kind: "retry" });
    expect(await getToken()).toBe(TOKEN);
    expect(onUnauthorized).not.toHaveBeenCalled();

    // Online again, and the server no longer accepts the token.
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));
    expect(await revalidateSession()).toEqual({ kind: "rejected" });
    expect(await getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("offline boot, then 401: the app's unauthorized handler (the shared wipe, expired mode) runs exactly once", async () => {
    // Registered exactly as AuthProvider does: the 401 handler is the shared wipe in expired mode.
    setUnauthorizedHandler(() => void wipeUserData({ expired: true }));

    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "offline", user: USER });
    expect(wipeUserData).not.toHaveBeenCalled();

    expect(await revalidateSession()).toEqual({ kind: "retry" });
    expect(wipeUserData).not.toHaveBeenCalled();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));
    expect(await revalidateSession()).toEqual({ kind: "rejected" });
    expect(await getToken()).toBeNull();
    expect(wipeUserData).toHaveBeenCalledTimes(1);
    expect(wipeUserData).toHaveBeenCalledWith({ expired: true });
  });

  it("a valid /me after an offline start returns the fresh user and keeps the token", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await bootFromSavedToken();
    fetchMock.mockReset();
    const fresh = { ...USER, name: "Maya R" };
    fetchMock.mockResolvedValue(json(200, { user: fresh }));
    expect(await revalidateSession()).toEqual({ kind: "online", user: fresh });
    expect(await getToken()).toBe(TOKEN);
  });

  it("offline with no cached user for this token keeps the token but cannot open signed in", async () => {
    store.delete("chessschool.lastUser");
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "unverified" });
    expect(await getToken()).toBe(TOKEN);
  });

  it("never reuses another account's cached user for a different token", async () => {
    await setToken("tok-other-account-ffffffffffffffffffff");
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "unverified" });
  });

  it("with no saved token it does not call the server", async () => {
    store.clear();
    expect(await bootFromSavedToken()).toEqual({ kind: "none" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("unverified start (token kept, no cached user): becomes signed in once /me answers", async () => {
    store.delete("chessschool.lastUser");
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "unverified" });
    expect(await revalidateSession()).toEqual({ kind: "retry" });
    expect(await getToken()).toBe(TOKEN);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(200, { user: USER }));
    expect(await revalidateSession()).toEqual({ kind: "online", user: USER });
    expect(await getToken()).toBe(TOKEN);
    // ...and it is now cached for the next offline start.
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "offline", user: USER });
  });

  it("unverified start then 401: token cleared and onUnauthorized runs exactly once", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    store.delete("chessschool.lastUser");
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "unverified" });
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));
    expect(await revalidateSession()).toEqual({ kind: "rejected" });
    expect(await getToken()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });
});

describe("DP-M-005 a late /me reply never ties another account's token to the wrong user", () => {
  const TOKEN_B = "tok-B-account-9999999999999999999999999";
  const USER_B = { id: "u2", name: "Ben", email: "ben@example.com", role: "student" };

  it("A's revalidate in flight -> logout -> B signs in -> A's reply lands: nothing maps B to A", async () => {
    const onUnauthorized = vi.fn();
    setUnauthorizedHandler(onUnauthorized);
    // A has a session whose cached user is not stored yet (revalidating an unconfirmed start).
    store.delete("chessschool.lastUser");

    let resolveA!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (resolveA = res)));
    const pendingA = revalidateSession(); // captures TOKEN (A) before the request
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    // A logs out, B signs in (as login() does: setToken then rememberUser for B).
    await clearToken();
    await forgetUser();
    await setToken(TOKEN_B);
    await rememberUser(USER_B, TOKEN_B);

    resolveA(json(200, { user: USER })); // A's answer arrives late
    expect(await pendingA).toEqual({ kind: "stale" });
    expect(await getToken()).toBe(TOKEN_B);

    // B's cache still says B...
    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "offline", user: USER_B });
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("A's late reply cannot write a cache entry for B's token (B had none yet): B offline start is not A", async () => {
    store.delete("chessschool.lastUser");
    let resolveA!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (resolveA = res)));
    const pendingA = revalidateSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    await clearToken();
    await setToken(TOKEN_B); // B signed in; B's own user is not cached yet

    resolveA(json(200, { user: USER }));
    await pendingA;
    expect(store.has("chessschool.lastUser")).toBe(false);

    fetchMock.mockReset();
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    expect(await bootFromSavedToken()).toEqual({ kind: "unverified" }); // never "offline as A"
  });

  it("rememberUser(user, staleToken) is a no-op once the token has changed", async () => {
    store.clear();
    await setToken(TOKEN_B);
    await rememberUser(USER, TOKEN);
    expect(store.has("chessschool.lastUser")).toBe(false);
  });

  it("A's late 401 after B signed in does not clear B's token", async () => {
    let resolveA!: (r: Response) => void;
    fetchMock.mockReturnValueOnce(new Promise<Response>((res) => (resolveA = res)));
    const pendingA = revalidateSession();
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    await clearToken();
    await setToken(TOKEN_B);
    await rememberUser(USER_B, TOKEN_B);
    resolveA(json(401, { error: "unauthorized" }));
    expect(await pendingA).toEqual({ kind: "stale" });
    expect(await getToken()).toBe(TOKEN_B);
    fetchMock.mockRejectedValue(new TypeError("offline"));
    expect(await bootFromSavedToken()).toEqual({ kind: "offline", user: USER_B });
  });
});
