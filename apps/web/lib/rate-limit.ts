import { NextResponse } from "next/server";

/** In-memory sliding-window limiter — fine for single-region; swap for Redis at scale. */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_BUCKETS = 10_000;

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
};

export type RateLimitResult = { ok: true } | { ok: false; retryAfterSec: number };

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

export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  if (buckets.size > MAX_BUCKETS) {
    for (const [k, v] of buckets) {
      if (v.resetAt <= now) buckets.delete(k);
    }
  }

  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
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

export function rateLimitResponse(retryAfterSec: number): NextResponse {
  return NextResponse.json(
    { error: "rate_limited" },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/** Returns a 429 response when limited, otherwise null. */
export function enforceRateLimit(
  req: Request,
  bucket: string,
  opts: RateLimitOptions,
  userId?: string,
): NextResponse | null {
  const key = rateLimitKey(bucket, clientIp(req), userId);
  const result = checkRateLimit(key, opts);
  if (!result.ok) return rateLimitResponse(result.retryAfterSec);
  return null;
}

/** Server Actions — same buckets, keyed by IP from request headers. */
export function enforceRateLimitHeaders(
  h: Headers,
  bucket: string,
  opts: RateLimitOptions,
): { error: string } | null {
  const key = rateLimitKey(bucket, clientIpFromHeaders(h));
  const result = checkRateLimit(key, opts);
  if (!result.ok) return { error: "Too many attempts — try again in a minute." };
  return null;
}

/** @internal test helper */
export function resetRateLimitsForTests(): void {
  buckets.clear();
}
