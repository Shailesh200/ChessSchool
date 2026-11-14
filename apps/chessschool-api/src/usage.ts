import { and, desc, gte, lt, sql } from "drizzle-orm";
import type { Db } from "./db";
import { events } from "./schema";
import { USAGE_EVENTS as EVENT_NAMES, type UsageEventName as EventName, type UsageSummary } from "@chessschool/design";

export { EVENT_NAMES };

export const MAX_EVENTS_PER_BATCH = 50;
/** Events older than this are deleted. */
export const RETENTION_DAYS = 180;
const DAY = 86_400_000;

export type EventRow = typeof events.$inferInsert;

const ID = /^[A-Za-z0-9_-]{1,64}$/;
const isName = (v: unknown): v is EventName => typeof v === "string" && (EVENT_NAMES as readonly string[]).includes(v);
const smallInt = (v: unknown, max: number) => (typeof v === "number" && Number.isInteger(v) && v >= 0 && v <= max ? v : null);

/**
 * Validates a batch from POST /v1/events. Unknown or malformed events are dropped, not rejected,
 * so one bad entry never costs the rest. Times must fall within the last week and not in the future.
 */
export function parseEvents(raw: unknown, nowMs: number): EventRow[] | null {
  const b = raw as { install?: unknown; platform?: unknown; appVersion?: unknown; events?: unknown } | null;
  if (!b || typeof b !== "object" || typeof b.install !== "string" || !ID.test(b.install) || !Array.isArray(b.events)) return null;
  const platform = b.platform === "ios" || b.platform === "android" || b.platform === "web" ? b.platform : null;
  const appVersion = typeof b.appVersion === "string" && /^[0-9A-Za-z.+-]{1,20}$/.test(b.appVersion) ? b.appVersion : null;
  if (!platform || !appVersion) return null;
  const rows: EventRow[] = [];
  for (const e of b.events.slice(0, MAX_EVENTS_PER_BATCH) as { name?: unknown; at?: unknown; lesson?: unknown; step?: unknown; value?: unknown }[]) {
    if (!e || typeof e !== "object" || !isName(e.name)) continue;
    const at = typeof e.at === "number" && e.at <= nowMs + 60_000 && e.at >= nowMs - 7 * DAY ? Math.floor(e.at) : null;
    if (at === null) continue;
    rows.push({
      at,
      install: b.install,
      name: e.name,
      lesson: typeof e.lesson === "string" && ID.test(e.lesson) ? e.lesson : null,
      step: smallInt(e.step, 500),
      value: smallInt(e.value, 1_000_000),
      platform,
      appVersion,
    });
  }
  return rows;
}

export async function recordEvents(db: Db, rows: EventRow[], nowMs: number): Promise<void> {
  if (rows.length) await db.insert(events).values(rows);
  // Trim old rows now and then rather than on a schedule.
  if (Math.random() < 0.02) await db.delete(events).where(lt(events.at, nowMs - RETENTION_DAYS * DAY));
}

/** The internal dashboard's numbers for the last `days` days. */
export async function usageSummary(db: Db, nowMs: number, days: number): Promise<UsageSummary> {
  const since = nowMs - days * DAY;
  const inRange = gte(events.at, since);
  const [installs] = await db.select({ n: sql<number>`count(distinct ${events.install})` }).from(events).where(inRange);
  const daily = await db
    .select({ day: sql<string>`date(${events.at} / 1000, 'unixepoch')`, installs: sql<number>`count(distinct ${events.install})` })
    .from(events)
    .where(inRange)
    .groupBy(sql`1`)
    .orderBy(sql`1`);
  const perLesson = await db
    .select({
      lesson: events.lesson,
      starts: sql<number>`sum(case when ${events.name} = 'lesson_start' then 1 else 0 end)`,
      finishes: sql<number>`sum(case when ${events.name} = 'lesson_finish' then 1 else 0 end)`,
      quits: sql<number>`sum(case when ${events.name} = 'lesson_quit' then 1 else 0 end)`,
    })
    .from(events)
    .where(and(inRange, sql`${events.lesson} is not null`, sql`${events.name} in ('lesson_start', 'lesson_finish', 'lesson_quit')`))
    .groupBy(events.lesson);
  const quitSteps = await db
    .select({ lesson: events.lesson, step: events.step, n: sql<number>`count(*)` })
    .from(events)
    .where(and(inRange, sql`${events.name} = 'lesson_quit'`, sql`${events.step} is not null`))
    .groupBy(events.lesson, events.step)
    .orderBy(desc(sql`count(*)`));
  const topQuit = new Map<string, number>();
  for (const q of quitSteps) if (q.lesson && !topQuit.has(q.lesson) && q.step !== null) topQuit.set(q.lesson, q.step);
  const counts = await db.select({ name: events.name, n: sql<number>`count(*)` }).from(events).where(inRange).groupBy(events.name);
  const count = (name: EventName) => Number(counts.find((c) => c.name === name)?.n ?? 0);
  const platforms = await db.select({ platform: events.platform, installs: sql<number>`count(distinct ${events.install})` }).from(events).where(inRange).groupBy(events.platform);
  return {
    days,
    installs: Number(installs?.n ?? 0),
    daily: daily.map((d) => ({ day: d.day, installs: Number(d.installs) })),
    lessons: perLesson
      .filter((l): l is typeof l & { lesson: string } => Boolean(l.lesson))
      .map((l) => {
        const starts = Number(l.starts);
        const finishes = Number(l.finishes);
        return { lesson: l.lesson, starts, finishes, quits: Number(l.quits), completion: starts ? Math.round((finishes / starts) * 100) : 0, topQuitStep: topQuit.get(l.lesson) ?? null };
      }),
    puzzles: { solved: count("puzzle_solved"), failed: count("puzzle_failed") },
    games: count("game_finished"),
    platforms: platforms.map((p) => ({ platform: p.platform, installs: Number(p.installs) })),
  };
}
