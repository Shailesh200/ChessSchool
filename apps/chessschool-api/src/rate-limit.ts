import { sql } from "drizzle-orm";
import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import type { Db } from "./db";
import { hashToken, SESSION_COOKIE } from "./security";

/**
 * Request budgets for every public route, per IP and (when a session token is sent) per account.
 * Strict budgets (sign-up, sign-in, challenge links, reports, uploads, email) count in the database
 * (cs_rate_limits), so every serverless instance sees the same counts. The roomy "general" and play budgets
 * count per instance in memory: a database write on every request roughly tripled latency in the local
 * load test, and a flood guard does not need to be exact. The older limiters in app.ts stay as a further layer.
 *
 * Windows are fixed: the key carries the window number, so a counter never needs resetting, and old
 * rows are swept now and then. If the counter store fails, the request goes through (fail open):
 * an outage of the limiter must never take the API down with it.
 */

export type Budget = { limit: number; windowMs: number };
/** `shared` budgets count in the database (every instance sees them); the rest count per instance, in memory. */
export type Rule = { name: string; method?: string; path: RegExp; ip: Budget; user?: Budget; shared?: boolean };

const MIN = 60_000;
const HOUR = 60 * MIN;

/**
 * First match wins. Generous where a learner plays (moves, puzzles, course), strict where a request
 * creates something or costs money (sign-up, sign-in, challenges, reports, uploads, email).
 * A device-test run on one CI runner makes a few hundred requests in ten minutes, well inside "general".
 */
export const RULES: Rule[] = [
  { name: "signup", shared: true, method: "POST", path: /^\/v1\/auth\/register$/, ip: { limit: 30, windowMs: HOUR } },
  { name: "signin", shared: true, method: "POST", path: /^\/v1\/auth\/(login|google|apple)$/, ip: { limit: 30, windowMs: 10 * MIN } },
  { name: "challenge-create", shared: true, method: "POST", path: /^\/v1\/challenges$/, ip: { limit: 60, windowMs: HOUR }, user: { limit: 30, windowMs: HOUR } },
  { name: "challenge-join", shared: true, method: "POST", path: /^\/v1\/challenges\/[^/]+\/accept$/, ip: { limit: 30, windowMs: 10 * MIN } },
  { name: "challenge-play", method: "POST", path: /^\/v1\/challenges\/[^/]+\/(moves|resign|draw|result)$/, ip: { limit: 300, windowMs: MIN } },
  { name: "report", shared: true, method: "POST", path: /\/(report|block)$|^\/v1\/feedback$/, ip: { limit: 20, windowMs: HOUR }, user: { limit: 10, windowMs: HOUR } },
  { name: "upload", shared: true, method: "POST", path: /^\/v1\/(scan|import\/pgn|import\/games|shares)$/, ip: { limit: 40, windowMs: HOUR }, user: { limit: 30, windowMs: HOUR } },
  { name: "email", shared: true, path: /^\/v1\/email\//, ip: { limit: 30, windowMs: HOUR } },
  { name: "events", method: "POST", path: /^\/v1\/events$/, ip: { limit: 120, windowMs: MIN } },
  { name: "general", path: /^\/(v1|ota)\//, ip: { limit: 600, windowMs: MIN }, user: { limit: 400, windowMs: MIN } },
];

/** Never limited: the uptime check and the CORS preflight. Cron routes are behind their own secret. */
const EXEMPT = /^\/(v1\/)?health$|^\/v1\/cron\//;

export function ruleFor(method: string, path: string, rules: Rule[] = RULES): Rule | null {
  if (method === "OPTIONS" || EXEMPT.test(path)) return null;
  return rules.find((r) => (!r.method || r.method === method) && r.path.test(path)) ?? null;
}

export type Hit = { count: number; resetAt: number };
/** Adds one to the counter for `key` in the window that contains `nowMs`. */
export type RateStore = (key: string, windowMs: number, nowMs: number) => Promise<Hit>;

export function memoryRateStore(maxKeys = 20_000): RateStore {
  const hits = new Map<string, Hit>();
  return async (key, windowMs, nowMs) => {
    const w = Math.floor(nowMs / windowMs);
    const k = `${key}:${w}`;
    const h = hits.get(k) ?? { count: 0, resetAt: (w + 1) * windowMs };
    h.count += 1;
    hits.set(k, h);
    if (hits.size > maxKeys) {
      for (const [old, v] of hits) if (v.resetAt <= nowMs) hits.delete(old);
      // Still full inside one window (a spread-out flood): start over rather than scan on every request.
      if (hits.size > maxKeys / 2) hits.clear();
    }
    return h;
  };
}

export function dbRateStore(db: Db): RateStore {
  return async (key, windowMs, nowMs) => {
    const w = Math.floor(nowMs / windowMs);
    const resetAt = (w + 1) * windowMs;
    const rows = await db.all<{ count: number }>(
      sql`INSERT INTO cs_rate_limits (key, count, reset_at) VALUES (${`${key}:${w}`}, 1, ${resetAt}) ON CONFLICT(key) DO UPDATE SET count = count + 1 RETURNING count`,
    );
    // Sweep finished windows on about one request in a hundred.
    if (Math.random() < 0.01) await db.run(sql`DELETE FROM cs_rate_limits WHERE reset_at < ${nowMs}`);
    return { count: Number(rows[0]?.count ?? 1), resetAt };
  };
}

export const clientIp = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

/** The account key: a hash of the session token, so no session lookup is needed before the route runs. */
function accountKey(c: Context): string | null {
  const h = c.req.header("Authorization");
  const token = h?.startsWith("Bearer ") ? h.slice(7).trim() : getCookie(c, SESSION_COOKIE);
  return token ? hashToken(token).slice(0, 24) : null;
}

export function rateLimits({ store, local = memoryRateStore(), now = () => Date.now(), rules = RULES, onError }: { store: RateStore; local?: RateStore; now?: () => number; rules?: Rule[]; onError?: (err: unknown) => void }): MiddlewareHandler {
  return async (c, next) => {
    const rule = ruleFor(c.req.method, c.req.path, rules);
    if (rule) {
      const t = now();
      const account = rule.user ? accountKey(c) : null;
      const checks: [string, Budget][] = [[`${rule.name}:ip:${clientIp(c)}`, rule.ip]];
      if (account && rule.user) checks.push([`${rule.name}:u:${account}`, rule.user]);
      let blockedUntil = 0;
      try {
        const counter = rule.shared ? store : local;
        const hits = await Promise.all(checks.map(([key, b]) => counter(key, b.windowMs, t)));
        hits.forEach((h, i) => {
          if (h.count > checks[i]![1].limit) blockedUntil = Math.max(blockedUntil, h.resetAt);
        });
      } catch (err) {
        onError?.(err);
      }
      if (blockedUntil) {
        c.header("Retry-After", String(Math.max(1, Math.ceil((blockedUntil - t) / 1000))));
        return c.json({ error: "rate_limited" }, 429);
      }
    }
    await next();
    // The per-route limiters in app.ts answer 429 without a hint; their windows are a minute or more.
    if (c.res.status === 429 && !c.res.headers.get("Retry-After")) c.res.headers.set("Retry-After", "60");
  };
}
