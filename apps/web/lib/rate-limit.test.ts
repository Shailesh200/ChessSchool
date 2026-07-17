import { describe, expect, it, beforeEach } from "vitest";
import {
  checkRateLimit,
  rateLimitKey,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => resetRateLimitsForTests());

  it("allows requests under the limit", () => {
    const key = rateLimitKey("auth:login", "1.2.3.4");
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
    expect(checkRateLimit(key, { limit: 3, windowMs: 60_000 }).ok).toBe(true);
  });

  it("blocks when the window is exhausted", () => {
    const key = rateLimitKey("auth:login", "1.2.3.4");
    const opts = { limit: 2, windowMs: 60_000 };
    expect(checkRateLimit(key, opts).ok).toBe(true);
    expect(checkRateLimit(key, opts).ok).toBe(true);
    const blocked = checkRateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keys IP and user buckets separately", () => {
    const ipKey = rateLimitKey("progress", "9.9.9.9");
    const userKey = rateLimitKey("progress", "9.9.9.9", "user-1");
    const opts = { limit: 1, windowMs: 60_000 };
    expect(checkRateLimit(ipKey, opts).ok).toBe(true);
    expect(checkRateLimit(userKey, opts).ok).toBe(true);
    expect(checkRateLimit(ipKey, opts).ok).toBe(false);
    expect(checkRateLimit(userKey, opts).ok).toBe(false);
  });
});
