import { describe, expect, it, vi } from "vitest";
import {
  ABLY_DROP_EVENTS,
  ablyTokenUrl,
  createAblyPollingFallback,
  createGameAblyAuth,
  type AblyTokenFetch,
} from "./ablyAuth";

const API = "https://api.test";
const GAME = "11111111-1111-4111-8111-111111111111";

function tokenResponse(body: unknown, ok = true): Awaited<ReturnType<AblyTokenFetch>> {
  return { ok, json: async () => body };
}

function authorize(
  auth: ReturnType<typeof createGameAblyAuth>,
): Promise<{ error: string | null; tokenRequest: unknown }> {
  return new Promise((resolve) => {
    auth({}, (error, tokenRequest) =>
      resolve({
        error: typeof error === "string" ? error : null,
        tokenRequest,
      }),
    );
  });
}

describe("createGameAblyAuth", () => {
  it("treats failed and suspended as the drop-to-polling states", () => {
    expect(ABLY_DROP_EVENTS).toEqual(["failed", "suspended"]);
  });

  it("calls getToken again on renewal and sends the new bearer", async () => {
    const getToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce("session-old")
      .mockResolvedValueOnce("session-new");
    const first = {
      keyName: "app.key",
      mac: "one",
      capability: '{"game:a":["subscribe"]}',
    };
    const second = {
      keyName: "app.key",
      mac: "two",
      capability: '{"game:a":["subscribe"]}',
    };
    const fetchImpl = vi
      .fn<AblyTokenFetch>()
      .mockResolvedValueOnce(tokenResponse(first))
      .mockResolvedValueOnce(tokenResponse(second));
    const onAuthError = vi.fn();
    const auth = createGameAblyAuth({
      apiUrl: API,
      gameId: GAME,
      getToken,
      fetchImpl,
      onAuthError,
    });

    const opened = await authorize(auth);
    const renewed = await authorize(auth);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(ablyTokenUrl(API, GAME));
    expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBe(
      "Bearer session-old",
    );
    expect(fetchImpl.mock.calls[1]?.[1].headers.authorization).toBe(
      "Bearer session-new",
    );
    expect(opened).toEqual({ error: null, tokenRequest: first });
    expect(renewed).toEqual({ error: null, tokenRequest: second });
    expect(onAuthError).not.toHaveBeenCalled();
  });

  it("drops back to polling when renewal fails", async () => {
    const ablyRef = { current: true };
    const close = vi.fn();
    const dropToPolling = createAblyPollingFallback({ ablyRef, close });
    const getToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce("session-old")
      .mockResolvedValueOnce("session-new");
    const fetchImpl = vi
      .fn<AblyTokenFetch>()
      .mockResolvedValueOnce(tokenResponse({ mac: "one" }))
      .mockResolvedValueOnce(tokenResponse({ error: "login required" }, false));
    const auth = createGameAblyAuth({
      apiUrl: `${API}/`,
      gameId: GAME,
      getToken,
      fetchImpl,
      onAuthError: dropToPolling,
    });

    const opened = await authorize(auth);
    expect(opened.error).toBeNull();
    expect(ablyRef.current).toBe(true);
    expect(close).not.toHaveBeenCalled();

    const renewed = await authorize(auth);
    expect(getToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[1].headers.authorization).toBe(
      "Bearer session-new",
    );
    expect(renewed.error).toBe("ably token request failed");
    expect(renewed.tokenRequest).toBeNull();
    expect(ablyRef.current).toBe(false);
    expect(close).toHaveBeenCalledTimes(1);

    // failed + suspended both use this fallback; a second signal must not close again
    dropToPolling();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("sends the guest seat token again on renewal", async () => {
    const getToken = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
    const getSeatToken = vi
      .fn<() => Promise<string | null>>()
      .mockResolvedValueOnce("w.seat-old")
      .mockResolvedValueOnce("w.seat-new");
    const first = { keyName: "app.key", mac: "one" };
    const second = { keyName: "app.key", mac: "two" };
    const fetchImpl = vi
      .fn<AblyTokenFetch>()
      .mockResolvedValueOnce(tokenResponse(first))
      .mockResolvedValueOnce(tokenResponse(second));
    const onAuthError = vi.fn();
    const auth = createGameAblyAuth({
      apiUrl: API,
      gameId: GAME,
      getToken,
      getSeatToken,
      fetchImpl,
      onAuthError,
    });

    const opened = await authorize(auth);
    const renewed = await authorize(auth);

    expect(getToken).toHaveBeenCalledTimes(2);
    expect(getSeatToken).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[0]?.[1].headers.authorization).toBeUndefined();
    expect(fetchImpl.mock.calls[0]?.[1].headers["x-seat-token"]).toBe("w.seat-old");
    expect(fetchImpl.mock.calls[1]?.[1].headers["x-seat-token"]).toBe("w.seat-new");
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(ablyTokenUrl(API, GAME));
    expect(opened).toEqual({ error: null, tokenRequest: first });
    expect(renewed).toEqual({ error: null, tokenRequest: second });
    expect(onAuthError).not.toHaveBeenCalled();
  });

  it("errors without fetching when the session token is gone", async () => {
    const dropToPolling = vi.fn();
    const fetchImpl = vi.fn<AblyTokenFetch>();
    const auth = createGameAblyAuth({
      apiUrl: API,
      gameId: GAME,
      getToken: async () => null,
      fetchImpl,
      onAuthError: dropToPolling,
    });

    const result = await authorize(auth);
    expect(result.error).toBe("login required");
    expect(result.tokenRequest).toBeNull();
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(dropToPolling).toHaveBeenCalledTimes(1);
  });
});
