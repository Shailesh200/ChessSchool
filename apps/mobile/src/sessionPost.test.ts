import { describe, expect, it } from "vitest";
import { sessionStateFromPost, shouldRetryApiFailure } from "./sessionPost";

const row = {
  error: "conflict",
  fen: "8/8/8/8/8/8/8/8 w - - 0 1",
  turn: "w" as const,
  status: "active" as const,
  result: null,
  pgn: "",
};

describe("shouldRetryApiFailure", () => {
  const timeout = Object.assign(new Error("timed out"), { name: "TimeoutError" });
  const aborted = Object.assign(new Error("aborted"), { name: "AbortError" });

  it("does not retry session POSTs on timeout", () => {
    expect(shouldRetryApiFailure("/api/session/abc", "POST", timeout)).toBe(false);
    expect(shouldRetryApiFailure("/api/session/abc", "post", aborted)).toBe(false);
    expect(shouldRetryApiFailure("/api/session", "POST", timeout)).toBe(false);
    expect(shouldRetryApiFailure("/api/session/abc?join=1", "POST", timeout)).toBe(false);
  });

  it("still retries session GETs and other POSTs on timeout", () => {
    expect(shouldRetryApiFailure("/api/session/abc", "GET", timeout)).toBe(true);
    expect(shouldRetryApiFailure("/api/session/abc", undefined, aborted)).toBe(true);
    expect(shouldRetryApiFailure("/api/progress", "POST", timeout)).toBe(true);
  });

  it("still retries a session POST on a network TypeError", () => {
    expect(shouldRetryApiFailure("/api/session/abc", "POST", new TypeError("network"))).toBe(
      true,
    );
  });

  it("does not retry HTTP errors", () => {
    const http = Object.assign(new Error("conflict"), { name: "ApiError" });
    expect(shouldRetryApiFailure("/api/session/abc", "POST", http)).toBe(false);
  });
});

describe("sessionStateFromPost", () => {
  it("returns the 409 row without the error flag", () => {
    const state = sessionStateFromPost(409, row);
    expect(state).toMatchObject({ fen: row.fen, turn: "w", status: "active" });
    expect(state).not.toHaveProperty("error");
  });

  it("returns null when the 409 is not a session row", () => {
    expect(sessionStateFromPost(409, { error: "not your turn" })).toBeNull();
    expect(sessionStateFromPost(400, row)).toBeNull();
  });
});
