import { NextResponse } from "next/server";
import { ipAddress } from "@vercel/functions";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limits for auth, session, TTS, and the other hot routes.
 *
 * Default store is in-process (local dev, tests, CI). When a Vercel
 * Marketplace Upstash pair is set, checks use `@upstash/ratelimit` so
 * serverless instances share one counter. Same bucket names, limits, and
 * logical key shape as before.
 *
 * Every key is prefixed with `chess-school:rl:${VERCEL_ENV ?? "local"}` in
 * both stores. Preview, staging, and a laptop therefore cannot consume
 * production budget when they point at the same Redis database. Staging
 * should still have its own database; the prefix is defence in depth.
 *
 * `auth:login` and `auth:register` use a sliding window so a burst on a
 * clock boundary cannot take about twice the budget. Other buckets stay on
 * a fixed window. Upstash sliding mode is the SDK's weighted mix of the
 * current and previous fixed windows. The in-memory store keeps a log of
 * hit timestamps in the last `windowMs` (a true sliding log). Same limit
 * and window; near a boundary they can differ by a request or two.
 *
 * Fixed windows: Redis buckets are clock-aligned. The in-memory window
 * still starts on the first hit.
 *
 * If Redis throws or the SDK times out, that request is counted on the
 * in-memory store instead. The failure is logged once per instance. Further
 * Redis attempts wait out a short cooldown.
 */

const MAX_BUCKETS = 10_000;
const SLIDING_BUCKETS = new Set(["auth:login", "auth:register"]);
/** SDK timeout. On expiry it resolves `success: true`; we treat that as a failure. */
const REDIS_TIMEOUT_MS = 1_500;
/** After a Redis failure, stay on the in-memory store this long. */
const REDIS_COOLDOWN_MS = 30_000;

export type RateLimitAlgorithm = "fixed" | "sliding";

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  /** Set for tests. Login and register default to sliding; everything else is fixed. */
  algorithm?: RateLimitAlgorithm;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

/** One hit against a shared or local counter. */
export interface RateLimitStore {
  consume(key: string, opts: RateLimitOptions): Promise<RateLimitResult>;
}

type Bucket = { count: number; resetAt: number };

class MemoryRateLimitStore implements RateLimitStore {
  private buckets = new Map<string, Bucket>();
  private sliding = new Map<string, number[]>();

  consume(key: string, opts: RateLimitOptions): Promise<RateLimitResult> {
    const scoped = scopedRateLimitKey(key);
    return Promise.resolve(
      opts.algorithm === "sliding"
        ? this.hitSliding(scoped, opts)
        : this.hit(scoped, opts),
    );
  }

  reset(): void {
    this.buckets.clear();
    this.sliding.clear();
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

  /** Timestamp log: only hits newer than `windowMs` count. */
  private hitSliding(key: string, opts: RateLimitOptions): RateLimitResult {
    const now = Date.now();
    const start = now - opts.windowMs;
    if (this.sliding.size > MAX_BUCKETS) {
      for (const [bucketKey, hits] of this.sliding) {
        if (hits.every((ts) => ts <= start)) this.sliding.delete(bucketKey);
      }
    }
    const recent = (this.sliding.get(key) ?? []).filter((ts) => ts > start);
    if (recent.length >= opts.limit) {
      this.sliding.set(key, recent);
      const retryAt = recent[0]! + opts.windowMs;
      return {
        ok: false,
        retryAfterSec: Math.max(1, Math.ceil((retryAt - now) / 1000)),
      };
    }
    recent.push(now);
    this.sliding.set(key, recent);
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
    const prefix = rateLimitPrefix();
    const algorithm = opts.algorithm ?? "fixed";
    const id = `${prefix}:${algorithm}:${opts.limit}:${opts.windowMs}`;
    const existing = this.limiters.get(id);
    if (existing) return existing;
    const window = windowDuration(opts.windowMs);
    const limiter = new Ratelimit({
      redis: this.redis,
      limiter:
        algorithm === "sliding"
          ? Ratelimit.slidingWindow(opts.limit, window)
          : Ratelimit.fixedWindow(opts.limit, window),
      prefix,
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

/**
 * Vercel sets `x-real-ip` to the client address. `ipAddress()` reads that
 * header. A caller-supplied `X-Forwarded-For` list is not used: its first
 * hop is spoofable. Missing both sources yields `unknown`.
 */
function readClientIp(input: Request | Headers): string {
  try {
    const platform = ipAddress(input)?.trim();
    if (platform) return platform;
  } catch {
    // Off Vercel the helper is best-effort and must not fail the request.
  }
  const real = headerBag(input).get("x-real-ip")?.trim();
  return real || "unknown";
}

/**
 * Use `input` when it has a callable `.get`. Next's `headers()` value is a
 * HeadersAdapter: it has `.get`, and also a `.headers` plain object that does
 * not. A Request has no `.get`; its bag is `.headers`.
 */
function headerBag(input: Request | Headers): Headers {
  if (hasCallableGet(input)) return input;
  return input.headers;
}

function hasCallableGet(input: Request | Headers): input is Headers {
  return typeof (input as { get?: unknown }).get === "function";
}

export function clientIp(req: Request): string {
  return readClientIp(req);
}

export function clientIpFromHeaders(h: Headers): string {
  return readClientIp(h);
}

export function rateLimitKey(bucket: string, ip: string, userId?: string): string {
  return userId ? `${bucket}:u:${userId}` : `${bucket}:ip:${ip}`;
}

/** `chess-school:rl:production` | `preview` | `development`, or `local` when unset. */
export function rateLimitPrefix(env: NodeJS.ProcessEnv = process.env): string {
  return `chess-school:rl:${env.VERCEL_ENV ?? "local"}`;
}

export async function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): Promise<RateLimitResult> {
  const resolved = resolveRateLimitOptions(key, opts);
  if (Date.now() < redisDisabledUntil) return memoryStore.consume(key, resolved);
  try {
    const upstash = getUpstashStore();
    if (!upstash) return memoryStore.consume(key, resolved);
    return await upstash.consume(key, resolved);
  } catch (err) {
    redisDisabledUntil = Date.now() + REDIS_COOLDOWN_MS;
    reportRedisFailure(err);
    return memoryStore.consume(key, resolved);
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

function scopedRateLimitKey(key: string): string {
  return `${rateLimitPrefix()}:${key}`;
}

function bucketFromKey(key: string): string {
  const cuts = [":ip:", ":u:"]
    .map((marker) => key.indexOf(marker))
    .filter((index) => index >= 0);
  if (cuts.length === 0) return key;
  return key.slice(0, Math.min(...cuts));
}

function resolveRateLimitOptions(
  key: string,
  opts: RateLimitOptions,
): RateLimitOptions {
  if (opts.algorithm) return opts;
  const algorithm = SLIDING_BUCKETS.has(bucketFromKey(key)) ? "sliding" : "fixed";
  return { ...opts, algorithm };
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
