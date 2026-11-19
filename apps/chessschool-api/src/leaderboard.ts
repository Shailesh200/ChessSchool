import { firstName, isAvatarId, isCountry, leagueWeek, sanitizeRatings, type BoardMetric, type BoardResponse, type BoardRow, type BoardScope } from "@chessschool/design";
import { and, eq, inArray } from "drizzle-orm";
import type { Context, Hono } from "hono";
import type { Db } from "./db";
import { follows, leaderboardHidden, leagueMembers, profiles, ratings, users } from "./schema";

type UserRow = typeof users.$inferSelect;
type Guard = (c: Context<{ Variables: { user: UserRow } }>, next: () => Promise<void>) => Promise<unknown>;
export type BoardDeps = { db: Db; now: () => Date; requireUser: Guard; limiter: (key: string) => boolean };

export const BOARD_SIZE = 50;
const SCOPES = new Set<BoardScope>(["global", "country", "friends"]);
const METRICS = new Set<BoardMetric>(["xp", "rating", "wins"]);

/**
 * Ranks values high to low; equal values share a rank (1, 2, 2, 4). Ties keep the order given.
 * Exported for the test.
 */
export function rankRows<T extends { value: number }>(rows: T[]): (T & { rank: number })[] {
  const sorted = [...rows].sort((a, b) => b.value - a.value);
  let rank = 0;
  return sorted.map((r, i) => {
    if (i === 0 || sorted[i - 1]!.value !== r.value) rank = i + 1;
    return { ...r, rank };
  });
}

/** Each account's value for one metric. Only accounts (never child profiles) and only non-zero values take part. */
async function metricValues(db: Db, metric: BoardMetric, nowMs: number): Promise<Map<string, number>> {
  const out = new Map<string, number>();
  if (metric === "xp") {
    for (const r of await db.select({ id: leagueMembers.userId, xp: leagueMembers.xp }).from(leagueMembers).where(eq(leagueMembers.week, leagueWeek(nowMs)))) if (r.xp > 0) out.set(r.id, r.xp);
    return out;
  }
  // A child's ratings row has its own learner id; the account's own row uses the user id.
  for (const r of await db.select().from(ratings)) {
    if (r.learnerId !== r.userId) continue;
    const parsed = sanitizeRatings(JSON.parse(r.data));
    const v = metric === "rating" ? (parsed.player.games > 0 ? parsed.player.rating : 0) : (parsed.bestWin ?? 0);
    if (v > 0) out.set(r.userId, v);
  }
  return out;
}

export function mountLeaderboard(app: Hono<{ Variables: { user: UserRow } }>, { db, now, requireUser, limiter }: BoardDeps) {
  app.get("/v1/leaderboard", requireUser, async (c) => {
    const me = c.get("user");
    const scope = c.req.query("scope") as BoardScope;
    const metric = c.req.query("metric") as BoardMetric;
    if (!SCOPES.has(scope) || !METRICS.has(metric)) return fail(c, "invalid_input");
    // shortcut: ranks every account in memory; move to SQL ORDER BY/LIMIT with an index once accounts reach the tens of thousands.
    const values = await metricValues(db, metric, now().getTime());
    const myProfile = await db.query.profiles.findFirst({ where: eq(profiles.userId, me.id) });
    const myCountry = isCountry(myProfile?.country) ? myProfile.country : null;
    const friendIds = new Set((await db.select({ id: follows.friendId }).from(follows).where(eq(follows.userId, me.id))).map((r) => r.id));
    const hidden = new Set((await db.select().from(leaderboardHidden)).map((h) => h.userId));
    if (scope === "country" && !myCountry) return c.json({ scope, metric, rows: [], me: { rank: null, value: values.get(me.id) ?? 0 }, needsCountry: true } satisfies BoardResponse);

    let ids = [...values.keys()].filter((id) => id === me.id || !hidden.has(id));
    if (scope === "friends") ids = ids.filter((id) => id === me.id || friendIds.has(id));
    const people = ids.length ? await db.select({ id: users.id, name: users.name, kind: users.kind, avatar: profiles.avatar, country: profiles.country }).from(users).leftJoin(profiles, eq(profiles.userId, users.id)).where(inArray(users.id, ids)) : [];
    const pool = people.filter((p) => p.kind === "member" || p.id === me.id).filter((p) => scope !== "country" || p.country === myCountry);
    const ranked = rankRows(pool.map((p) => ({ ...p, value: values.get(p.id) ?? 0 })));
    const toRow = (p: (typeof ranked)[number]): BoardRow => ({
      id: p.id,
      rank: p.rank,
      name: firstName(p.name) || "Player",
      avatar: isAvatarId(p.avatar) ? p.avatar : "cody",
      country: isCountry(p.country) ? p.country : null,
      value: p.value,
      friend: friendIds.has(p.id),
      me: p.id === me.id,
    });
    const mine = ranked.find((p) => p.id === me.id);
    return c.json({ scope, metric, rows: ranked.slice(0, BOARD_SIZE).map(toRow), me: { rank: mine?.rank ?? null, value: mine?.value ?? values.get(me.id) ?? 0 }, needsCountry: false } satisfies BoardResponse);
  });

  /** Adds a friend (one way, no request to accept). Only full accounts can be added, and never yourself. */
  app.post("/v1/friends/:id", requireUser, async (c) => {
    const me = c.get("user");
    const id = c.req.param("id") ?? "";
    if (!limiter(`friend:${me.id}`)) return fail(c, "rate_limited");
    if (!id || id === me.id) return fail(c, "invalid_input");
    const other = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!other || other.kind !== "member") return fail(c, "not_found");
    await db.insert(follows).values({ userId: me.id, friendId: id, createdAt: now().getTime() }).onConflictDoNothing();
    return c.json({ ok: true });
  });

  app.delete("/v1/friends/:id", requireUser, async (c) => {
    const me = c.get("user");
    await db.delete(follows).where(and(eq(follows.userId, me.id), eq(follows.friendId, c.req.param("id") ?? "")));
    return c.json({ ok: true });
  });
}

const STATUS = { invalid_input: 400, not_found: 404, rate_limited: 429 } as const;
const fail = (c: Context, code: keyof typeof STATUS) => c.json({ error: code }, STATUS[code]);
