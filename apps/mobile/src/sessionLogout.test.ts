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
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

import { getToken, setToken } from "./api";
import { flushPendingRevokes, logoutOnce } from "./sessionLogout";
import { wipeUserData } from "./wipeUserData";

const TOKEN = "tok-0123456789abcdef0123456789abcdef";
const PENDING = "chessschool.pendingRevoke";

function json(status: number, body: unknown = {}): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
}

const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>();
const tick = () => new Promise((r) => setTimeout(r, 0));

beforeEach(async () => {
  store.clear();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  await setToken(TOKEN);
});

describe("DP-M-006 logout clears local state first and revokes in the background", () => {
  it("never waits for the server: with a request that never answers, logout still resolves signed out", async () => {
    fetchMock.mockReturnValue(new Promise<Response>(() => {})); // hangs (the old 45 s timeout + retry)
    const wipe = vi.fn(async () => {});
    await logoutOnce(wipe); // would hang forever if it awaited the revoke
    expect(await getToken()).toBeNull();
    expect(wipe).toHaveBeenCalledTimes(1);
  });

  it("clears the token and runs the local wipe BEFORE any request is made", async () => {
    const order: string[] = [];
    fetchMock.mockImplementation(async (url, init) => {
      order.push(`fetch ${String(url).replace(/^.*\/api/, "/api")} auth=${(init?.headers as Record<string, string>).authorization}`);
      order.push(`token-at-fetch=${await getToken()}`);
      return json(200);
    });
    await logoutOnce(async () => void order.push("wipe"));
    await tick();
    expect(order[0]).toBe("wipe");
    expect(order[1]).toBe(`fetch /api/auth/logout auth=Bearer ${TOKEN}`);
    expect(order[2]).toBe("token-at-fetch=null"); // revoke uses the captured token, not the store
  });

  it("offline: the revoke failure does not keep the user signed in, and the token is kept to retry", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await logoutOnce(async () => {});
    await tick();
    expect(await getToken()).toBeNull();
    expect(JSON.parse(store.get(PENDING) ?? "[]")).toEqual([TOKEN]);
  });

  it("the queued revoke is retried at the next start and removed once the server accepts it", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await logoutOnce(async () => {});
    await tick();

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(200));
    await flushPendingRevokes();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect((fetchMock.mock.calls[0]![1]!.headers as Record<string, string>).authorization).toBe(`Bearer ${TOKEN}`);
    expect(store.has(PENDING)).toBe(false);
  });

  it("still offline at the next start: it stays queued; a 401 (already invalid) drops it", async () => {
    store.set(PENDING, JSON.stringify([TOKEN]));
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await flushPendingRevokes();
    expect(JSON.parse(store.get(PENDING)!)).toEqual([TOKEN]);

    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(401, { error: "unauthorized" }));
    await flushPendingRevokes();
    expect(store.has(PENDING)).toBe(false);
  });

  it("a successful revoke leaves nothing queued", async () => {
    fetchMock.mockResolvedValue(json(200));
    await logoutOnce(async () => {});
    await tick();
    expect(store.has(PENDING)).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("double tap: concurrent logouts share one run (one wipe, one revoke)", async () => {
    fetchMock.mockResolvedValue(json(200));
    const wipe = vi.fn(async () => {
      await tick();
    });
    const a = logoutOnce(wipe);
    const b = logoutOnce(wipe);
    const c = logoutOnce(wipe);
    await Promise.all([a, b, c]);
    await tick();
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a later logout (after the first finished) runs again", async () => {
    fetchMock.mockResolvedValue(json(200));
    const wipe = vi.fn(async () => {});
    await logoutOnce(wipe);
    await setToken("tok-second-session-ffffffffffffffffff");
    await logoutOnce(wipe);
    expect(wipe).toHaveBeenCalledTimes(2);
    expect(await getToken()).toBeNull();
  });

  it("with no token (already signed out) it still runs the local wipe and makes no request", async () => {
    store.clear();
    const wipe = vi.fn(async () => {});
    await logoutOnce(wipe);
    await tick();
    expect(wipe).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("the REAL wipeUserData leaves the queued revoke alone (not user data: it must survive logout and expiry wipes)", async () => {
    fetchMock.mockRejectedValue(new TypeError("Network request failed"));
    await logoutOnce(async () => {}); // offline: the revoke is queued
    await tick();
    expect(JSON.parse(store.get(PENDING) ?? "[]")).toEqual([TOKEN]);
    await wipeUserData(); // logout / delete-account wipe
    expect(JSON.parse(store.get(PENDING) ?? "[]")).toEqual([TOKEN]);
    await wipeUserData({ expired: true }); // 401 wipe
    expect(JSON.parse(store.get(PENDING) ?? "[]")).toEqual([TOKEN]);
    // and it is still delivered at the next start
    fetchMock.mockReset();
    fetchMock.mockResolvedValue(json(200));
    await flushPendingRevokes();
    expect(store.get(PENDING)).toBeUndefined();
  });
});
