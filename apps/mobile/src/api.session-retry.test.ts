import { afterEach, describe, expect, it, vi } from "vitest";

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

import { ApiError, api } from "./api";

function timeout(): Error {
  const error = new Error("timed out");
  error.name = "TimeoutError";
  return error;
}

function ok(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
  } as Response;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("api session retry", () => {
  it("does not retry a session POST on timeout", async () => {
    const fetchMock = vi.fn(async () => {
      throw timeout();
    });
    vi.stubGlobal("fetch", fetchMock);
    await expect(
      api("/api/session/game-1", { method: "POST", body: { action: "move" } }),
    ).rejects.toMatchObject({ name: "TimeoutError" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("retries a session GET on timeout", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw timeout();
        return ok({ fen: "fresh" });
      }),
    );
    await expect(api<{ fen: string }>("/api/session/game-1")).resolves.toEqual({ fen: "fresh" });
    expect(calls).toBe(2);
  });

  it("retries other POSTs on timeout", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        calls += 1;
        if (calls === 1) throw timeout();
        return ok({ ok: true });
      }),
    );
    await expect(api("/api/progress", { method: "POST", body: {} })).resolves.toEqual({
      ok: true,
    });
    expect(calls).toBe(2);
  });

  it("keeps the session row on a 409 and does not retry", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: false,
      status: 409,
      json: async () => ({ error: "conflict", fen: "server-fen", turn: "w", status: "active" }),
    }));
    vi.stubGlobal("fetch", fetchMock);
    try {
      await api("/api/session/game-1", { method: "POST", body: { action: "move" } });
      expect.unreachable("409 should throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const apiError = error as ApiError;
      expect(apiError.status).toBe(409);
      expect(apiError.message).toBe("conflict");
      expect(apiError.body).toMatchObject({ fen: "server-fen", error: "conflict" });
    }
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
