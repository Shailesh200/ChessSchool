import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  checkRateLimit,
  enforceRateLimit,
  enforceRateLimitHeaders,
  rateLimitKey,
  rateLimitPrefix,
  resetRateLimitsForTests,
} from "@/lib/rate-limit";

const redisState = vi.hoisted(() => {
  type LimitResult = {
    success: boolean;
    limit: number;
    remaining: number;
    reset: number;
    pending: Promise<unknown>;
    reason?: "timeout" | "cacheBlock" | "denyList";
  };
  return {
    redis: [] as { url?: string; token?: string; retry?: { retries?: number } }[],
    fixedWindow: [] as { tokens: number; window: string }[],
    slidingWindow: [] as { tokens: number; window: string }[],
    configs: [] as {
      prefix?: string;
      timeout?: number;
      analytics?: boolean;
      enableTelemetry?: boolean;
      enableProtection?: boolean;
      dynamicLimits?: boolean;
      limiter: { tokens: number; window: string; kind?: "fixed" | "sliding" };
    }[],
    counts: new Map<string, number>(),
    limit: vi.fn<(key: string, tokens: number) => Promise<LimitResult>>(),
  };
});

const sentry = vi.hoisted(() => ({
  captureException: vi.fn(),
}));

const platformIp = vi.hoisted(() => ({
  override: null as ((input: Request | Headers) => string | undefined) | null,
}));

vi.mock("@upstash/redis", () => ({
  Redis: class Redis {
    constructor(opts: { url?: string; token?: string; retry?: { retries?: number } }) {
      redisState.redis.push(opts);
    }
  },
}));

vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class Ratelimit {
    private tokens: number;
    private prefix: string;
    static fixedWindow(tokens: number, window: string) {
      redisState.fixedWindow.push({ tokens, window });
      return { tokens, window, kind: "fixed" as const };
    }
    static slidingWindow(tokens: number, window: string) {
      redisState.slidingWindow.push({ tokens, window });
      return { tokens, window, kind: "sliding" as const };
    }
    constructor(config: (typeof redisState.configs)[number]) {
      this.tokens = config.limiter.tokens;
      this.prefix = config.prefix ?? "";
      redisState.configs.push(config);
    }
    limit(key: string) {
      // The real SDK stores `${prefix}:${identifier}`.
      return redisState.limit(`${this.prefix}:${key}`, this.tokens);
    }
  },
}));

vi.mock("@vercel/functions", async () => {
  const actual =
    await vi.importActual<typeof import("@vercel/functions")>("@vercel/functions");
  return {
    ipAddress: (input: Request | Headers) =>
      platformIp.override ? platformIp.override(input) : actual.ipAddress(input),
  };
});

vi.mock("@sentry/nextjs", () => ({
  captureException: sentry.captureException,
}));

const ENV_KEYS = [
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "KV_REST_API_URL",
  "KV_REST_API_TOKEN",
] as const;

function clearRedisEnv(): void {
  for (const key of ENV_KEYS) delete process.env[key];
}

function countedLimit(key: string, tokens: number) {
  const count = (redisState.counts.get(key) ?? 0) + 1;
  redisState.counts.set(key, count);
  return {
    success: count <= tokens,
    limit: tokens,
    remaining: Math.max(0, tokens - count),
    reset: Date.now() + 60_000,
    pending: Promise.resolve(),
  };
}

const vercelEnvBefore = process.env.VERCEL_ENV;

function restoreVercelEnv(): void {
  if (vercelEnvBefore === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = vercelEnvBefore;
}

describe("checkRateLimit", () => {
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    clearRedisEnv();
    restoreVercelEnv();
    platformIp.override = null;
    redisState.redis.length = 0;
    redisState.fixedWindow.length = 0;
    redisState.slidingWindow.length = 0;
    redisState.configs.length = 0;
    redisState.counts.clear();
    redisState.limit.mockReset();
    redisState.limit.mockImplementation(async (key, tokens) =>
      countedLimit(key, tokens),
    );
    sentry.captureException.mockReset();
    resetRateLimitsForTests();
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    errorSpy.mockRestore();
    vi.useRealTimers();
    clearRedisEnv();
    restoreVercelEnv();
    platformIp.override = null;
    resetRateLimitsForTests();
  });

  it("allows requests under the limit", async () => {
    const key = rateLimitKey("auth:login", "1.2.3.4");
    expect((await checkRateLimit(key, { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    expect((await checkRateLimit(key, { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    expect((await checkRateLimit(key, { limit: 3, windowMs: 60_000 })).ok).toBe(true);
    expect(redisState.redis).toHaveLength(0);
  });

  it("blocks when the window is exhausted", async () => {
    const key = rateLimitKey("auth:login", "1.2.3.4");
    const opts = { limit: 2, windowMs: 60_000 };
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    const blocked = await checkRateLimit(key, opts);
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("keys IP and user buckets separately", async () => {
    const ipKey = rateLimitKey("progress", "9.9.9.9");
    const userKey = rateLimitKey("progress", "9.9.9.9", "user-1");
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit(ipKey, opts)).ok).toBe(true);
    expect((await checkRateLimit(userKey, opts)).ok).toBe(true);
    expect((await checkRateLimit(ipKey, opts)).ok).toBe(false);
    expect((await checkRateLimit(userKey, opts)).ok).toBe(false);
  });

  it("opens a new in-memory window after windowMs", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    const key = rateLimitKey("auth:login", "1.1.1.1");
    const opts = { limit: 1, windowMs: 1_000 };
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    vi.setSystemTime(new Date("2026-01-01T00:00:01.001Z"));
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
  });

  it("resetRateLimitsForTests clears in-memory buckets", async () => {
    const key = rateLimitKey("auth:login", "4.4.4.4");
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    resetRateLimitsForTests();
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
  });

  it("keys by ipAddress() and keeps the 429 shape", async () => {
    platformIp.override = () => "203.0.113.10";
    const opts = { limit: 1, windowMs: 60_000 };
    const spoofed = new Request("http://test", {
      headers: {
        "x-forwarded-for": "1.1.1.1, 2.2.2.2",
        "x-real-ip": "9.9.9.9",
      },
    });
    expect(await enforceRateLimit(spoofed, "events", opts)).toBeNull();
    const blocked = await enforceRateLimit(spoofed, "events", opts);
    expect(blocked?.status).toBe(429);
    expect(blocked?.headers.get("Retry-After")).toBeTruthy();
    expect(await blocked?.json()).toEqual({ error: "rate_limited" });

    platformIp.override = () => undefined;
    const fromRealIp = new Request("http://test", {
      headers: { "x-real-ip": "9.9.9.9", "x-forwarded-for": "1.1.1.1" },
    });
    expect(await enforceRateLimit(fromRealIp, "events", opts)).toBeNull();
  });

  it("ignores a spoofed X-Forwarded-For list", async () => {
    platformIp.override = () => undefined;
    const opts = { limit: 1, windowMs: 60_000 };
    const first = new Request("http://test", {
      headers: { "x-forwarded-for": "1.1.1.1, 2.2.2.2" },
    });
    const other = new Request("http://test", {
      headers: { "x-forwarded-for": "8.8.8.8" },
    });
    expect(await enforceRateLimit(first, "events", opts)).toBeNull();
    expect((await enforceRateLimit(other, "events", opts))?.status).toBe(429);
  });

  it("uses unknown when the platform helper throws and no x-real-ip is set", async () => {
    platformIp.override = () => {
      throw new Error("platform unavailable");
    };
    const opts = { limit: 1, windowMs: 60_000 };
    const req = new Request("http://test", {
      headers: { "x-forwarded-for": "1.1.1.1" },
    });
    expect(await enforceRateLimit(req, "events", opts)).toBeNull();
    expect((await enforceRateLimit(req, "events", opts))?.status).toBe(429);
  });

  it("returns the server-action error from headers", async () => {
    const headers = new Headers({ "x-real-ip": "7.7.7.7" });
    const opts = { limit: 1, windowMs: 60_000 };
    expect(await enforceRateLimitHeaders(headers, "auth:login", opts)).toBeNull();
    expect(await enforceRateLimitHeaders(headers, "auth:login", opts)).toEqual({
      error: "Too many attempts — try again in a minute.",
    });
  });

  it("uses Upstash when UPSTASH_REDIS_REST_* is set and shares that counter", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    const opts = { limit: 2, windowMs: 60_000 };
    const key = rateLimitKey("auth:login", "8.8.8.8");
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    expect(redisState.redis[0]).toMatchObject({
      url: "https://example.upstash.io",
      token: "test-token-value",
      retry: { retries: 0 },
    });
    const stored = `${rateLimitPrefix()}:${key}`;
    expect(redisState.slidingWindow).toEqual([{ tokens: 2, window: "60 s" }]);
    expect(redisState.fixedWindow).toEqual([]);
    expect(redisState.configs[0]).toMatchObject({
      prefix: "chess-school:rl:local",
      analytics: false,
      enableProtection: false,
      enableTelemetry: false,
      dynamicLimits: false,
      timeout: 1_500,
    });
    expect(redisState.limit.mock.calls.map((call) => call[0])).toEqual([
      stored,
      stored,
      stored,
    ]);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it("passes sub-second windows through as milliseconds", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    await checkRateLimit("burst", { limit: 4, windowMs: 1_500 });
    expect(redisState.fixedWindow).toEqual([{ tokens: 4, window: "1500 ms" }]);
  });

  it("prefers the Upstash pair over KV_REST_API_*", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "upstash-token-value";
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "kv-token-value";
    await checkRateLimit("k", { limit: 3, windowMs: 60_000 });
    expect(redisState.redis[0]).toMatchObject({
      url: "https://example.upstash.io",
      token: "upstash-token-value",
    });
  });

  it("uses KV_REST_API_* when that pair is the one that is complete", async () => {
    process.env.KV_REST_API_URL = "https://kv.example";
    process.env.KV_REST_API_TOKEN = "kv-token-value";
    await checkRateLimit("k", { limit: 3, windowMs: 60_000 });
    expect(redisState.redis[0]).toMatchObject({
      url: "https://kv.example",
      token: "kv-token-value",
    });
  });

  it("stays in memory when the token is missing", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "   ";
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(false);
    expect(redisState.redis).toHaveLength(0);
  });

  it("honors a Redis deny even when the in-memory budget remains", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    redisState.limit.mockResolvedValue({
      success: false,
      limit: 5,
      remaining: 0,
      reset: Date.now() + 5_000,
      pending: Promise.resolve(),
      reason: "cacheBlock",
    });
    const blocked = await checkRateLimit("k", { limit: 5, windowMs: 60_000 });
    expect(blocked.ok).toBe(false);
    if (!blocked.ok) expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });

  it("falls open to memory when Redis throws, and logs once without secrets", async () => {
    const token = "super-secret-token-value";
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = token;
    redisState.limit.mockRejectedValue(
      new Error(`connect failed ${token} at https://example.upstash.io?token=${token}`),
    );
    const opts = { limit: 2, windowMs: 60_000 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(false);
    expect(redisState.limit).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = errorSpy.mock.calls.flat().join(" ");
    expect(logged).toContain("using in-memory limiter");
    expect(logged).not.toContain(token);
    expect(logged).not.toContain("https://example.upstash.io");
    await vi.waitFor(() => {
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
    });
    const reported = sentry.captureException.mock.calls[0]?.[0] as Error;
    expect(reported.name).toBe("RateLimitStoreError");
    expect(reported.message).not.toContain(token);
    expect(reported.message).not.toContain("https://");
    expect(sentry.captureException.mock.calls[0]?.[1]).toMatchObject({
      level: "warning",
      tags: { subsystem: "rate-limit" },
    });
  });

  it("counts an SDK timeout on the in-memory limiter", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    redisState.limit.mockResolvedValue({
      success: true,
      limit: 0,
      remaining: 0,
      reset: 0,
      pending: Promise.resolve(),
      reason: "timeout",
    });
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(false);
    expect(redisState.limit).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it("retries Redis after the cooldown and does not log again", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    redisState.limit.mockRejectedValue(new Error("redis down"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    await checkRateLimit("k", { limit: 10, windowMs: 60_000 });
    await checkRateLimit("k", { limit: 10, windowMs: 60_000 });
    expect(redisState.limit).toHaveBeenCalledTimes(1);
    vi.setSystemTime(new Date("2026-01-01T00:00:30.000Z"));
    await checkRateLimit("k", { limit: 10, windowMs: 60_000 });
    expect(redisState.limit).toHaveBeenCalledTimes(2);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    await vi.waitFor(() => {
      expect(sentry.captureException).toHaveBeenCalledTimes(1);
    });
  });

  it("swallows a rejected ratelimit pending promise", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    let rejectPending: (err: Error) => void = () => {};
    const pending = new Promise<void>((_resolve, reject) => {
      rejectPending = reject;
    });
    redisState.limit.mockResolvedValue({
      success: true,
      limit: 5,
      remaining: 4,
      reset: Date.now() + 60_000,
      pending,
    });
    await expect(checkRateLimit("k", { limit: 5, windowMs: 60_000 })).resolves.toEqual({
      ok: true,
    });
    rejectPending(new Error("background analytics"));
    await Promise.resolve();
  });

  it("keeps production, preview, and local memory counters apart", async () => {
    const key = rateLimitKey("events", "5.5.5.5");
    const opts = { limit: 1, windowMs: 60_000 };

    process.env.VERCEL_ENV = "production";
    expect(rateLimitPrefix()).toBe("chess-school:rl:production");
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    process.env.VERCEL_ENV = "preview";
    expect(rateLimitPrefix()).toBe("chess-school:rl:preview");
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    delete process.env.VERCEL_ENV;
    expect(rateLimitPrefix()).toBe("chess-school:rl:local");
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    process.env.VERCEL_ENV = "production";
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
  });

  it("scopes Upstash keys by VERCEL_ENV so environments do not share a counter", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    const key = rateLimitKey("vitals", "5.5.5.5");
    const opts = { limit: 1, windowMs: 60_000 };

    process.env.VERCEL_ENV = "production";
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    process.env.VERCEL_ENV = "preview";
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    delete process.env.VERCEL_ENV;
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);

    expect(redisState.configs.map((config) => config.prefix)).toEqual([
      "chess-school:rl:production",
      "chess-school:rl:preview",
      "chess-school:rl:local",
    ]);
    expect(redisState.fixedWindow).toHaveLength(3);
    expect(redisState.slidingWindow).toHaveLength(0);
    process.env.VERCEL_ENV = "production";
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
  });

  it("uses slidingWindow for login and register only", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    await checkRateLimit(rateLimitKey("auth:login", "1.1.1.1"), {
      limit: 15,
      windowMs: 60_000,
    });
    await checkRateLimit(rateLimitKey("auth:register", "1.1.1.1"), {
      limit: 10,
      windowMs: 60_000,
    });
    await checkRateLimit(rateLimitKey("session:create", "1.1.1.1", "user-1"), {
      limit: 30,
      windowMs: 60_000,
    });
    expect(redisState.slidingWindow).toEqual([
      { tokens: 15, window: "60 s" },
      { tokens: 10, window: "60 s" },
    ]);
    expect(redisState.fixedWindow).toEqual([{ tokens: 30, window: "60 s" }]);
  });

  it("slides auth:login in memory instead of resetting the whole window", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const key = rateLimitKey("auth:login", "1.2.3.4");
    const opts = { limit: 2, windowMs: 10_000 };
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    vi.setSystemTime(9_000);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    vi.setSystemTime(10_000);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
  });

  it("keeps the sliding log when login falls open to memory", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    redisState.limit.mockRejectedValue(new Error("redis down"));
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(0);
    const key = rateLimitKey("auth:register", "4.4.4.4");
    const opts = { limit: 2, windowMs: 10_000 };
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    vi.setSystemTime(9_000);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    vi.setSystemTime(10_000);
    expect((await checkRateLimit(key, opts)).ok).toBe(true);
    expect((await checkRateLimit(key, opts)).ok).toBe(false);
    expect(redisState.limit).toHaveBeenCalledTimes(1);
  });

  it("forgets a cached Redis client after resetRateLimitsForTests", async () => {
    process.env.UPSTASH_REDIS_REST_URL = "https://example.upstash.io";
    process.env.UPSTASH_REDIS_REST_TOKEN = "test-token-value";
    await checkRateLimit("k", { limit: 5, windowMs: 60_000 });
    expect(redisState.redis).toHaveLength(1);
    clearRedisEnv();
    resetRateLimitsForTests();
    redisState.limit.mockClear();
    const opts = { limit: 1, windowMs: 60_000 };
    expect((await checkRateLimit("k", opts)).ok).toBe(true);
    expect((await checkRateLimit("k", opts)).ok).toBe(false);
    expect(redisState.limit).not.toHaveBeenCalled();
  });
});
