import { describe, it, expect, vi, afterEach } from "vitest";
import { formatSeatToken, verifySeatToken } from "./session-secret";

describe("session seat tokens", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("formats and verifies a user-bound token", () => {
    const token = formatSeatToken("game-1", "w", "user-1");
    expect(verifySeatToken("game-1", "w", "user-1", token)).toBe(true);
    expect(verifySeatToken("game-1", "b", "user-1", token)).toBe(false);
    expect(verifySeatToken("game-1", "w", "user-2", token)).toBe(false);
  });

  it("requires SESSION_TOKEN_SECRET in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("SESSION_TOKEN_SECRET", "");
    vi.resetModules();
    const { getSessionTokenSecret } = await import("./session-secret");
    expect(() => getSessionTokenSecret()).toThrow(/SESSION_TOKEN_SECRET/);
  });
});
