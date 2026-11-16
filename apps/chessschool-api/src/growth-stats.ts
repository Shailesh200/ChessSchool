import { gte, sql } from "drizzle-orm";
import type { Db } from "./db";
import { events, inviteAccepts } from "./schema";

const DAY = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const addDays = (day: string, n: number) => dayOf(Date.parse(`${day}T00:00:00Z`) + n * DAY);
const pct = (n: number, of: number) => (of ? Math.round((n / of) * 1000) / 10 : null);

export type GrowthStats = {
  /** UTC day the numbers were made for. */
  day: string;
  /** Share of installs first seen N days before a day in range that were active again exactly N days later (percent). */
  retention: { d1: number | null; d7: number | null; d30: number | null; cohort: { d1: number; d7: number; d30: number } };
  /** Average daily installs over monthly installs, last 30 days (percent). */
  stickiness: number | null;
  mau: number;
  /** Active installs per day, last 30 days, oldest first. */
  daily: { day: string; installs: number }[];
  shares: number;
  sharesPerActive: number | null;
  invites: { accepted: number; rewarded: number; conversion: number | null };
  /** Crash-free session rate (percent) from the crash reporter; null when it is not configured or failed. */
  crashFree: number | null;
};

/**
 * Growth numbers from the anonymous usage events (cs_events, kept 180 days) and the invite table.
 * Days are UTC. An install's first day is the first day it appears in the kept events.
 */
export async function growthStats(db: Db, nowMs: number, crashFree: number | null = null): Promise<GrowthStats> {
  const today = dayOf(nowMs);
  const rows = await db.select({ install: events.install, day: sql<string>`date(${events.at} / 1000, 'unixepoch')` }).from(events).groupBy(events.install, sql`2`);
  const days = new Map<string, Set<string>>();
  for (const r of rows) (days.get(r.install) ?? days.set(r.install, new Set()).get(r.install)!).add(r.day);

  const back = (n: number) => {
    let cohort = 0;
    let came = 0;
    for (const active of days.values()) {
      const first = [...active].sort()[0]!;
      // Only installs old enough to have had their day N (and day N is over).
      if (addDays(first, n) >= today) continue;
      cohort++;
      if (active.has(addDays(first, n))) came++;
    }
    return { cohort, rate: pct(came, cohort) };
  };
  const [d1, d7, d30] = [back(1), back(7), back(30)];

  const daily = Array.from({ length: 30 }, (_, i) => {
    const day = addDays(today, i - 29);
    let installs = 0;
    for (const active of days.values()) if (active.has(day)) installs++;
    return { day, installs };
  });
  const from = daily[0]!.day;
  let mau = 0;
  for (const active of days.values()) if ([...active].some((d) => d >= from && d <= today)) mau++;
  const avgDau = daily.reduce((n, d) => n + d.installs, 0) / daily.length;

  const [shared] = await db.select({ n: sql<number>`count(*)` }).from(events).where(sql`${events.name} = 'share' and ${gte(events.at, nowMs - 30 * DAY)}`);
  const shares = Number(shared?.n ?? 0);
  const [inv] = await db.select({ accepted: sql<number>`count(*)`, rewarded: sql<number>`sum(case when ${inviteAccepts.rewardedAt} is not null then 1 else 0 end)` }).from(inviteAccepts);
  const accepted = Number(inv?.accepted ?? 0);
  const rewarded = Number(inv?.rewarded ?? 0);
  return {
    day: today,
    retention: { d1: d1.rate, d7: d7.rate, d30: d30.rate, cohort: { d1: d1.cohort, d7: d7.cohort, d30: d30.cohort } },
    stickiness: pct(avgDau, mau),
    mau,
    daily,
    shares,
    sharesPerActive: mau ? Math.round((shares / mau) * 100) / 100 : null,
    invites: { accepted, rewarded, conversion: pct(rewarded, accepted) },
    crashFree,
  };
}

/** Wraps a slow lookup (the crash reporter's API) so it runs at most once per `ttlMs`; a failure reads as null. */
export function cached<T>(load: () => Promise<T | null>, ttlMs: number, now: () => number = Date.now) {
  let at = -Infinity;
  let value: T | null = null;
  return async () => {
    if (now() - at < ttlMs) return value;
    at = now();
    value = await load().catch(() => null);
    return value;
  };
}
