import { describe, expect, it } from "vitest";
import {
  hashSessionToken,
  isLegacySessionId,
  newSessionToken,
} from "@/lib/session-token";

describe("session token hashing", () => {
  it("produces stable 64-char hex digests", () => {
    const raw = "550e8400-e29b-41d4-a716-446655440000";
    const h = hashSessionToken(raw);
    expect(h).toHaveLength(64);
    expect(h).toMatch(/^[a-f0-9]+$/);
    expect(hashSessionToken(raw)).toBe(h);
  });

  it("issues UUID-shaped raw tokens", () => {
    const raw = newSessionToken();
    expect(raw).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );
    expect(hashSessionToken(raw)).not.toBe(raw);
  });

  it("detects legacy plaintext session ids", () => {
    const raw = newSessionToken();
    expect(isLegacySessionId(raw, raw)).toBe(true);
    expect(isLegacySessionId(hashSessionToken(raw), raw)).toBe(false);
  });
});
