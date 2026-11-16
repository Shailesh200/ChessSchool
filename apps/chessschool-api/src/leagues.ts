import { and, eq, inArray, sql } from "drizzle-orm";
import { firstName, formLeagues, indiaDay, LEAGUE_DAY_CAP, LEAGUE_SIZE, LEAGUE_TIERS, leagueWeek, nextWeek, rankLeague, settleLeague, weekClosesAt, zoneFor, type LeagueTier, type Zone } from "@chessschool/design";
import type { Db } from "./db";
import { leagueMembers, leaguePlayers, leagueWeeks, profiles, users } from "./schema";

export type LeagueView = {
  week: string;
  closesAt: number;
  tier: LeagueTier;
  members: { place: number; name: string; avatar: string | null; xp: number; you: boolean; zone: Zone }[];
  /** Set when last week's league moved this learner up into this tier (the apps celebrate it once). */
  promoted?: LeagueTier;
};

/**
 * Counts XP a learner earned (the rise in their synced progress) toward this week's league,
 * at most LEAGUE_DAY_CAP per India day. The first XP of a week puts them in a league of their tier
 * with room, after closing any week that has ended (so a late cron never leaves a stale tier).
 */
export async function addLeagueXp(db: Db, userId: string, delta: number, nowMs: number): Promise<void> {
  if (!(delta > 0)) return;
  const week = leagueWeek(nowMs);
  const day = indiaDay(nowMs);
  let row = await db.query.leagueMembers.findFirst({ where: and(eq(leagueMembers.week, week), eq(leagueMembers.userId, userId)) });
  if (!row) {
    await closeDueWeeks(db, nowMs);
    row = await db.query.leagueMembers.findFirst({ where: and(eq(leagueMembers.week, week), eq(leagueMembers.userId, userId)) });
  }
  if (!row) {
    await db.insert(leaguePlayers).values({ userId, tier: 0, joinedAt: nowMs }).onConflictDoNothing();
    const player = await db.query.leaguePlayers.findFirst({ where: eq(leaguePlayers.userId, userId) });
    const tier = player?.tier ?? 0;
    const groups = await db
      .select({ grp: leagueMembers.grp, n: sql<number>`count(*)` })
      .from(leagueMembers)
      .where(and(eq(leagueMembers.week, week), eq(leagueMembers.tier, tier)))
      .groupBy(leagueMembers.grp)
      .orderBy(leagueMembers.grp);
    const grp = groups.find((g) => Number(g.n) < LEAGUE_SIZE)?.grp ?? (groups.length ? Math.max(...groups.map((g) => g.grp)) + 1 : 1);
    row = { week, userId, tier, grp, xp: 0, day: null, dayXp: 0, updatedAt: nowMs };
    await db.insert(leagueMembers).values(row).onConflictDoNothing();
  }
  const used = row.day === day ? row.dayXp : 0;
  const add = Math.min(Math.floor(delta), LEAGUE_DAY_CAP - used);
  if (add <= 0) return;
  await db
    .update(leagueMembers)
    .set({ xp: sql`${leagueMembers.xp} + ${add}`, day, dayXp: used + add, updatedAt: nowMs })
    .where(and(eq(leagueMembers.week, week), eq(leagueMembers.userId, userId)));
}

/** This week's table for a learner, or null before their first XP of the week. */
export async function currentLeague(db: Db, userId: string, nowMs: number): Promise<LeagueView | null> {
  const week = leagueWeek(nowMs);
  const mine = await db.query.leagueMembers.findFirst({ where: and(eq(leagueMembers.week, week), eq(leagueMembers.userId, userId)) });
  if (!mine) return null;
  const rows = await db
    .select({ userId: leagueMembers.userId, xp: leagueMembers.xp, updatedAt: leagueMembers.updatedAt, name: users.name, avatar: profiles.avatar })
    .from(leagueMembers)
    .innerJoin(users, eq(users.id, leagueMembers.userId))
    .leftJoin(profiles, eq(profiles.userId, leagueMembers.userId))
    .where(and(eq(leagueMembers.week, week), eq(leagueMembers.tier, mine.tier), eq(leagueMembers.grp, mine.grp)));
  const ranked = rankLeague(rows);
  const last = await db.query.leagueMembers.findFirst({ where: and(eq(leagueMembers.week, leagueWeek(weekClosesAt(week) - 8 * 86_400_000)), eq(leagueMembers.userId, userId)) });
  return {
    ...(last && mine.tier > last.tier ? { promoted: LEAGUE_TIERS[mine.tier] } : {}),
    week,
    closesAt: weekClosesAt(week),
    tier: LEAGUE_TIERS[mine.tier] ?? "pawn",
    members: ranked.map((r, i) => ({ place: i + 1, name: firstName(r.name), avatar: r.avatar, xp: r.xp, you: r.userId === userId, zone: zoneFor(i, ranked.length, mine.tier, r.xp) })),
  };
}

/**
 * Closes every week that has ended and is not closed yet, oldest first: moves each league's top up
 * and bottom down, then forms next week's leagues from that week's active learners (when next week
 * is still running). Safe to run any number of times.
 */
export async function closeDueWeeks(db: Db, nowMs: number): Promise<{ closed: string[]; moved: { up: number; down: number } }> {
  const weeks = (await db.selectDistinct({ week: leagueMembers.week }).from(leagueMembers)).map((w) => w.week).sort();
  const done = new Set((await db.select().from(leagueWeeks)).map((w) => w.week));
  const closed: string[] = [];
  const moved = { up: 0, down: 0 };
  for (const week of weeks) {
    if (done.has(week) || weekClosesAt(week) > nowMs) continue;
    // Claim the week first, so two runs at once never move anyone twice.
    const claimed = await db.insert(leagueWeeks).values({ week, closedAt: nowMs }).onConflictDoNothing().returning();
    if (!claimed.length) continue;
    const rows = await db.select().from(leagueMembers).where(eq(leagueMembers.week, week));
    const groups = new Map<string, typeof rows>();
    for (const r of rows) groups.set(`${r.tier}:${r.grp}`, [...(groups.get(`${r.tier}:${r.grp}`) ?? []), r]);
    const next = new Map<string, number>();
    for (const g of groups.values()) {
      for (const s of settleLeague(g, g[0].tier)) {
        next.set(s.userId, s.tier);
        if (s.zone === "up") moved.up++;
        if (s.zone === "down") moved.down++;
      }
    }
    const writes = [...next].map(([userId, tier]) => db.update(leaguePlayers).set({ tier }).where(eq(leaguePlayers.userId, userId)));
    const following = nextWeek(week);
    const active = rows.filter((r) => r.xp > 0).map((r) => r.userId);
    if (active.length && weekClosesAt(following) > nowMs) {
      const players = await db.select().from(leaguePlayers).where(inArray(leaguePlayers.userId, active));
      const formed = formLeagues(players.map((p) => ({ ...p, tier: next.get(p.userId) ?? p.tier })));
      for (const f of formed) {
        writes.push(db.insert(leagueMembers).values({ week: following, userId: f.userId, tier: f.tier, grp: f.group, xp: 0, day: null, dayXp: 0, updatedAt: nowMs }).onConflictDoNothing() as never);
      }
    }
    for (let i = 0; i < writes.length; i += 200) await db.batch(writes.slice(i, i + 200) as [never, ...never[]]);
    closed.push(week);
  }
  return { closed, moved };
}
