import { NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limits for auth, session, TTS, and the other hot routes.
 *
 * Default store is an in-process fixed window (local dev, tests, CI). When a
 * Vercel Marketplace Upstash pair is set, checks use `@upstash/ratelimit`
 * `fixedWindow` so serverless instances share one counter. Same bucket names,
 * limits, and key shape as before.
 *
 * Redis is epoch-aligned (clock buckets). The in-memory window still starts
 * on the first hit. Both allow `limit` requests per `windowMs`.
 *
 * If Redis throws or the SDK times out, the request is counted on the
 * in-memory store instead. That keeps a single warm instance limiting during
 * an outage, and it does not turn the route into an error. The failure is
 * logged once per instance. Further Redis attempts wait out a short cooldown
 * so a dead store cannot add a timeout to every request.
 */

const MAX_BUCKETS = 10_000;
const REDIS_PREFIX = "chess-school:rl";
/** SDK timeout. On expiry it resolves `success: true`; we treat that as a failure. */
const REDIS_TIMEOUT_MS = 1_500;
/** After a Redis failure, stay on the in-memory store this long. */
const REDIS_COOLDOWN_MS = 30_000;

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/** One hit against a shared or local counter. */
export interface RateLimitStore {
  consume(key: string, opts: RateLimitOptions): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetAt: number };

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();

  consume(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
    return Promise.resolve(this.hit(key, opts));
  }

  reset(): void {
    this.buckets.clear();
  }

  /** Fixed window starting at the first hit. The body stays synchronous. */
  private hit(key: string, opts: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    if (this.buckets.size > MAX_BUCKETS) {
      for (const [bucketKey, bucket] of this.buckets) {
        if (bucket.resetAt <= now) this.buckets.delete(bucketKey);
      }
    }

    const cur = this.buckets.get(key);
    if (!cur || cur.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      return { ok: true };
    }
    if (cur.count >= opts.limit) {
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)),
      };
    }
    cur.count++;
    return { ok: true };
  }
}

class UpstashRateLimitStore implements RateLimitStore {
  private limiters = new Map<string, Ratelimit>();

  constructor(private redis: Redis) {}

  async consume(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
    const result = await this.limiterFor(opts).limit(key);
    if (result.pending) {
      void Promise.resolve(result.pending).catch(() => {
        // Analytics (off) or a background sync must not reject the request.
      });
    }
    // The SDK fail-opens a timeout as success. Count it locally instead.
    if (result.reason === "timeout") {
      throw new Error("Upstash rate limit timed out");
    }
    if (result.success) return { ok: true };
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)),
    };
  }

  private limiterFor(opts: RateLimitOptions): Ratelimit {
    const id = `${opts.limit}:${opts.windowMs}`;
    const existing = this.limiters.get(id);
    if (existing) return existing;
    const limiter = new Ratelimit({
      redis: this.redis,
      limiter: Ratelimit.fixedWindow(opts.limit, windowDuration(opts.windowMs)),
      prefix: REDIS_PREFIX,
      analytics: false,
      enableProtection: false,
      enableTelemetry: false,
      dynamicLimits: false,
      timeout: REDIS_TIMEOUT_MS,
    });
    this.limiters.set(id, limiter);
    return limiter;
  }
}

const memoryStore = new MemoryRateLimitStore();
let upstashStore: UpstashRateLimitStore | null = null;
let redisDisabledUntil = 0;
let redisFailureLogged = false;

export function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

export function clientIpFromHeaders(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip") ?? "unknown";
}

export function rateLimitKey(bucket: string, ip: string, userId?: string): string {
  return userId ? `${bucket}:u:${userId}` : `${bucket}:ip:${ip}`;
}

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  if (Date.now() < redisDisabledUntil) return memoryStore.consume(key, opts);
  try {
    const upstash = getUpstashStore();
    if (!upstash) return memoryStore.consume(key, opts);
    return await upstash.consume(key, opts);
  } catch (err) {
    redisDisabledUntil = Date.now() + REDIS_COOLDOWN_MS;
    reportRedisFailure(err);
    return memoryStore.consume(key, opts);
  }
}

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/** Returns a 429 response when limited, otherwise null. */
export async function enforceRateLimit(
  req: Request,
  bucket: string,
  opts: RateLimitOptions,
  userId?: string,
): Promise<NextResponse | null> {
  const key = rateLimitKey(bucket, clientIp(req), userId);
  const result = await checkRateLimit(key, opts);
  if (!result.ok) return rateLimitResponse(result.retryAfterSec);
  return null;
}

/** Server Actions — same buckets, keyed by IP from request headers. */
export async function enforceRateLimitHeaders(
  h: Headers,
  bucket: string,
  opts: RateLimitOptions,
): Promise<{ error: string } | null> {
  const key = rateLimitKey(bucket, clientIpFromHeaders(h));
  const result = await checkRateLimit(key, opts);
  if (!result.ok) return { error: "Too many attempts — try again in a minute." };
  return null;
}

/**
 * Clears in-process limiter state. Remote Redis keys are left alone; tests
 * mock the client. Also forgets the cached client so env changes take effect.
 */
export function resetRateLimitsForTests(): void {
  memoryStore.reset();
  upstashStore = null;
  redisDisabledUntil = 0;
  redisFailureLogged = false;
}

/**
 * Marketplace Upstash sets `UPSTASH_REDIS_REST_*` (`Redis.fromEnv`). Some
 * installs still inject the legacy KV REST names. A pair is used only when
 * both values are present so a URL is never sent with the other product's token.
 */
function readUpstashCredentials(
  env: NodeJS.ProcessEnv,
): { url: string; token: string } | null {
  const upstashUrl = env.UPSTASH_REDIS_REST_URL?.trim();
  const upstashToken = env.UPSTASH_REDIS_REST_TOKEN?.trim();
  if (upstashUrl && upstashToken) return { url: upstashUrl, token: upstashToken };

  const kvUrl = env.KV_REST_API_URL?.trim();
  const kvToken = env.KV_REST_API_TOKEN?.trim();
  if (kvUrl && kvToken) return { url: kvUrl, token: kvToken };
  return null;
}

function getUpstashStore(): UpstashRateLimitStore | null {
  if (upstashStore) return upstashStore;
  const creds = readUpstashCredentials(process.env);
  if (!creds) return null;
  const redis = new Redis({
    url: creds.url,
    token: creds.token,
    retry: { retries: 0, backoff: () => 0 },
  });
  upstashStore = new UpstashRateLimitStore(redis);
  return upstashStore;
}

function windowDuration(windowMs: number): `${number} s` | `${number} ms` {
  if (windowMs % 1000 === 0) return `${windowMs / 1000} s`;
  return `${windowMs} ms`;
}

function reportRedisFailure(err: unknown): void {
  if (redisFailureLogged) return;
  redisFailureLogged = true;
  let detail = "unknown error";
  try {
    detail = sanitizeRateLimitError(err);
  } catch {
    detail = "unknown error";
  }
  const message = `[rate-limit] Upstash unavailable; using in-memory limiter. ${detail}`;
  try {
    console.error(message);
  } catch {
    // Logging must not break the request.
  }
  const error = new Error(message);
  error.name = "RateLimitStoreError";
  void import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.captureException(error, {
        level: "warning",
        tags: { subsystem: "rate-limit" },
      });
    })
    .catch(() => {
      // Sentry is optional in local and test runtimes.
    });
}

function sanitizeRateLimitError(err: unknown): string {
  const raw = err instanceof Error ? err.message : "unknown error";
  let message = raw
    .replace(/https?:\/\/\S+/gi, "[redacted-url]")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(token|password|secret|authorization)[=:]\s*\S+/gi, "$1=[redacted]");
  for (const secret of configuredSecrets(process.env)) {
    message = message.split(secret).join("[redacted]");
  }
  return message.slice(0, 240);
}

function configuredSecrets(env: NodeJS.ProcessEnv): string[] {
  return [
    env.UPSTASH_REDIS_REST_URL,
    env.UPSTASH_REDIS_REST_TOKEN,
    env.KV_REST_API_URL,
    env.KV_REST_API_TOKEN,
  ].flatMap((value) => {
    const trimmed = value?.trim();
    return trimmed && trimmed.length >= 6 ? [trimmed] : [];
  });
}
