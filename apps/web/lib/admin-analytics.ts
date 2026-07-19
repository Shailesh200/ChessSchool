import { count, desc, eq, gte, sql, sum } from "drizzle-orm";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import { db as defaultDb } from "@/db";
import * as schema from "@/db/schema";
import {
  analyticsEvents,
  gameSessions,
  lessonRecords,
  lessons,
  oauthAccounts,
  profiles,
  progress,
  users,
} from "@/db/schema";

type Db = LibSQLDatabase<typeof schema>;

const DAY_MS = 86_400_000;
const MASTERED = 0.9;

const FUNNEL_STEPS = [
  "signup",
  "onboarding_complete",
  "lesson_start",
  "lesson_complete",
  "exam_complete",
  "class_graduate",
  "bot_game_start",
  "game_end",
] as const;

export type AdminAnalytics = {
  generatedAt: number;
  users: {
    total: number;
    students: number;
    admins: number;
    withGoogle: number;
    withPassword: number;
    withProgress: number;
    enrolled: number;
    onboarded: number;
    signedUpLast7d: number;
    signedUpLast30d: number;
  };
  lessons: {
    catalogSize: number;
    records: number;
    totalAttempts: number;
    started: number;
    mastered: number;
  };
  games: {
    total: number;
    waiting: number;
    active: number;
    over: number;
  };
  activity: {
    activeLast7d: number;
    activeLast30d: number;
    totalXp: number;
    avgStreak: number;
  };
  /** Continuous 30-day series (zeros filled). */
  signupsByDay: { day: string; count: number }[];
  /** Continuous 30-day series of lesson activity. */
  activityByDay: { day: string; activeUsers: number; touches: number }[];
  /** Continuous 30-day series of analytics events. */
  eventsByDay: { day: string; count: number }[];
  events: {
    name: string;
    count: number;
    uniqueUsers: number;
    lastAt: number | null;
  }[];
  funnel: { step: string; count: number; conversionFromPrev: number | null }[];
  topLessons: {
    lessonId: string;
    title: string;
    learners: number;
    attempts: number;
    mastered: number;
    avgMastery: number;
  }[];
  recentEvents: {
    name: string;
    pathname: string | null;
    userId: string | null;
    createdAt: number;
  }[];
  recentUsers: {
    id: string;
    email: string;
    name: string;
    role: string;
    createdAt: number;
    onboarded: boolean;
    auth: "google" | "password" | "unknown";
    xp: number;
  }[];
  topLearners: {
    userId: string;
    name: string;
    email: string;
    xp: number;
    streak: number;
    lessonsTouched: number;
  }[];
};

function sinceMs(days: number): number {
  return Date.now() - days * DAY_MS;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Fill missing calendar days so charts are continuous. */
export function fillDaySeries(
  days: number,
  rows: { day: string; count: number }[],
  endMs = Date.now(),
): { day: string; count: number }[] {
  const map = new Map(rows.map((r) => [r.day, r.count]));
  const out: { day: string; count: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(endMs - i * DAY_MS);
    out.push({ day: d, count: map.get(d) ?? 0 });
  }
  return out;
}

function fillActivitySeries(
  days: number,
  rows: { day: string; activeUsers: number; touches: number }[],
  endMs = Date.now(),
): { day: string; activeUsers: number; touches: number }[] {
  const map = new Map(rows.map((r) => [r.day, r]));
  const out: { day: string; activeUsers: number; touches: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = dayKey(endMs - i * DAY_MS);
    const hit = map.get(d);
    out.push({
      day: d,
      activeUsers: hit?.activeUsers ?? 0,
      touches: hit?.touches ?? 0,
    });
  }
  return out;
}

/** Aggregate product metrics for the admin dashboard (Turso / local SQLite). */
export async function getAdminAnalytics(
  conn: Db = defaultDb as Db,
): Promise<AdminAnalytics> {
  const now = Date.now();
  const d7 = sinceMs(7);
  const d30 = sinceMs(30);

  const [
    [userTotal],
    [studentTotal],
    [adminTotal],
    [googleTotal],
    [passwordTotal],
    [withProgress],
    [enrolled],
    [onboarded],
    [signedUp7],
    [signedUp30],
    [catalog],
    [lessonAgg],
    [started],
    [mastered],
    [gamesTotal],
    [gamesWaiting],
    [gamesActive],
    [gamesOver],
    [active7],
    [active30],
    eventRows,
    signupRows,
    eventDayRows,
    activityDayRows,
    topRows,
    recentEventRows,
    recentUserRows,
    topLearnerRows,
    [xpRow],
  ] = await Promise.all([
    conn.select({ n: count() }).from(users),
    conn.select({ n: count() }).from(users).where(eq(users.role, "student")),
    conn.select({ n: count() }).from(users).where(eq(users.role, "admin")),
    conn
      .select({ n: sql<number>`count(distinct ${oauthAccounts.userId})` })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.provider, "google")),
    conn
      .select({ n: count() })
      .from(users)
      .where(sql`${users.passwordHash} IS NOT NULL`),
    conn
      .select({ n: sql<number>`count(distinct ${lessonRecords.userId})` })
      .from(lessonRecords),
    conn.select({ n: count() }).from(profiles),
    conn.select({ n: count() }).from(profiles).where(eq(profiles.onboarded, 1)),
    conn.select({ n: count() }).from(users).where(gte(users.createdAt, d7)),
    conn.select({ n: count() }).from(users).where(gte(users.createdAt, d30)),
    conn.select({ n: count() }).from(lessons),
    conn
      .select({
        records: count(),
        attempts: sql<number>`coalesce(sum(${lessonRecords.attempts}), 0)`,
      })
      .from(lessonRecords),
    conn
      .select({ n: count() })
      .from(lessonRecords)
      .where(
        sql`${lessonRecords.attempts} > 0 OR ${lessonRecords.mastery} > 0`,
      ),
    conn
      .select({ n: count() })
      .from(lessonRecords)
      .where(gte(lessonRecords.mastery, MASTERED)),
    conn.select({ n: count() }).from(gameSessions),
    conn
      .select({ n: count() })
      .from(gameSessions)
      .where(eq(gameSessions.status, "waiting")),
    conn
      .select({ n: count() })
      .from(gameSessions)
      .where(eq(gameSessions.status, "active")),
    conn
      .select({ n: count() })
      .from(gameSessions)
      .where(eq(gameSessions.status, "over")),
    conn
      .select({
        n: sql<number>`count(distinct case when ${lessonRecords.lastSeen} >= ${d7} then ${lessonRecords.userId} end)`,
      })
      .from(lessonRecords),
    conn
      .select({
        n: sql<number>`count(distinct case when ${lessonRecords.lastSeen} >= ${d30} then ${lessonRecords.userId} end)`,
      })
      .from(lessonRecords),
    conn
      .select({
        name: analyticsEvents.name,
        count: count(),
        uniqueUsers: sql<number>`count(distinct ${analyticsEvents.userId})`,
        lastAt: sql<number>`max(${analyticsEvents.createdAt})`,
      })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.name)
      .orderBy(desc(count()))
      .limit(40),
    conn
      .select({
        day: sql<string>`date(${users.createdAt} / 1000, 'unixepoch')`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, d30))
      .groupBy(sql`date(${users.createdAt} / 1000, 'unixepoch')`),
    conn
      .select({
        day: sql<string>`date(${analyticsEvents.createdAt} / 1000, 'unixepoch')`,
        count: count(),
      })
      .from(analyticsEvents)
      .where(gte(analyticsEvents.createdAt, d30))
      .groupBy(sql`date(${analyticsEvents.createdAt} / 1000, 'unixepoch')`),
    conn
      .select({
        day: sql<string>`date(${lessonRecords.lastSeen} / 1000, 'unixepoch')`,
        activeUsers: sql<number>`count(distinct ${lessonRecords.userId})`,
        touches: count(),
      })
      .from(lessonRecords)
      .where(gte(lessonRecords.lastSeen, d30))
      .groupBy(sql`date(${lessonRecords.lastSeen} / 1000, 'unixepoch')`),
    conn
      .select({
        lessonId: lessonRecords.lessonId,
        title: sql<string>`coalesce(${lessons.title}, ${lessonRecords.lessonId})`,
        learners: count(),
        attempts: sql<number>`coalesce(sum(${lessonRecords.attempts}), 0)`,
        mastered: sql<number>`sum(case when ${lessonRecords.mastery} >= ${MASTERED} then 1 else 0 end)`,
        avgMastery: sql<number>`coalesce(avg(${lessonRecords.mastery}), 0)`,
      })
      .from(lessonRecords)
      .leftJoin(lessons, eq(lessonRecords.lessonId, lessons.id))
      .groupBy(lessonRecords.lessonId, lessons.title)
      .orderBy(desc(sum(lessonRecords.attempts)))
      .limit(25),
    conn
      .select({
        name: analyticsEvents.name,
        pathname: analyticsEvents.pathname,
        userId: analyticsEvents.userId,
        createdAt: analyticsEvents.createdAt,
      })
      .from(analyticsEvents)
      .orderBy(desc(analyticsEvents.createdAt))
      .limit(50),
    conn
      .select({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        createdAt: users.createdAt,
        hasPassword: sql<number>`case when ${users.passwordHash} is not null then 1 else 0 end`,
        onboarded: profiles.onboarded,
        xp: progress.xp,
        google: sql<number>`case when exists (
          select 1 from ${oauthAccounts}
          where ${oauthAccounts.userId} = ${users.id}
            and ${oauthAccounts.provider} = 'google'
        ) then 1 else 0 end`,
      })
      .from(users)
      .leftJoin(profiles, eq(profiles.userId, users.id))
      .leftJoin(progress, eq(progress.userId, users.id))
      .orderBy(desc(users.createdAt))
      .limit(40),
    conn
      .select({
        userId: progress.userId,
        name: users.name,
        email: users.email,
        xp: progress.xp,
        streak: progress.streak,
        lessonsTouched: sql<number>`(
          select count(*) from ${lessonRecords}
          where ${lessonRecords.userId} = ${progress.userId}
            and (${lessonRecords.attempts} > 0 or ${lessonRecords.mastery} > 0)
        )`,
      })
      .from(progress)
      .innerJoin(users, eq(users.id, progress.userId))
      .orderBy(desc(progress.xp))
      .limit(20),
    conn
      .select({
        totalXp: sql<number>`coalesce(sum(${progress.xp}), 0)`,
        avgStreak: sql<number>`coalesce(avg(${progress.streak}), 0)`,
      })
      .from(progress),
  ]);

  const events = eventRows.map((r) => ({
    name: r.name,
    count: Number(r.count),
    uniqueUsers: Number(r.uniqueUsers),
    lastAt: r.lastAt == null ? null : Number(r.lastAt),
  }));
  const eventCountByName = new Map(events.map((e) => [e.name, e.count]));

  const funnel = FUNNEL_STEPS.map((step, i) => {
    const c = eventCountByName.get(step) ?? 0;
    const prev = i === 0 ? null : (eventCountByName.get(FUNNEL_STEPS[i - 1]!) ?? 0);
    const conversionFromPrev =
      prev == null || prev === 0 ? null : Math.round((c / prev) * 1000) / 10;
    return { step, count: c, conversionFromPrev };
  });

  return {
    generatedAt: now,
    users: {
      total: Number(userTotal?.n ?? 0),
      students: Number(studentTotal?.n ?? 0),
      admins: Number(adminTotal?.n ?? 0),
      withGoogle: Number(googleTotal?.n ?? 0),
      withPassword: Number(passwordTotal?.n ?? 0),
      withProgress: Number(withProgress?.n ?? 0),
      enrolled: Number(enrolled?.n ?? 0),
      onboarded: Number(onboarded?.n ?? 0),
      signedUpLast7d: Number(signedUp7?.n ?? 0),
      signedUpLast30d: Number(signedUp30?.n ?? 0),
    },
    lessons: {
      catalogSize: Number(catalog?.n ?? 0),
      records: Number(lessonAgg?.records ?? 0),
      totalAttempts: Number(lessonAgg?.attempts ?? 0),
      started: Number(started?.n ?? 0),
      mastered: Number(mastered?.n ?? 0),
    },
    games: {
      total: Number(gamesTotal?.n ?? 0),
      waiting: Number(gamesWaiting?.n ?? 0),
      active: Number(gamesActive?.n ?? 0),
      over: Number(gamesOver?.n ?? 0),
    },
    activity: {
      activeLast7d: Number(active7?.n ?? 0),
      activeLast30d: Number(active30?.n ?? 0),
      totalXp: Math.round(Number(xpRow?.totalXp ?? 0)),
      avgStreak: Math.round(Number(xpRow?.avgStreak ?? 0) * 10) / 10,
    },
    signupsByDay: fillDaySeries(
      30,
      signupRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      now,
    ),
    eventsByDay: fillDaySeries(
      30,
      eventDayRows.map((r) => ({ day: r.day, count: Number(r.count) })),
      now,
    ),
    activityByDay: fillActivitySeries(
      30,
      activityDayRows.map((r) => ({
        day: r.day,
        activeUsers: Number(r.activeUsers),
        touches: Number(r.touches),
      })),
      now,
    ),
    events,
    funnel,
    topLessons: topRows.map((r) => ({
      lessonId: r.lessonId,
      title: r.title,
      learners: Number(r.learners),
      attempts: Number(r.attempts),
      mastered: Number(r.mastered),
      avgMastery: Math.round(Number(r.avgMastery) * 1000) / 10,
    })),
    recentEvents: recentEventRows.map((r) => ({
      name: r.name,
      pathname: r.pathname,
      userId: r.userId,
      createdAt: Number(r.createdAt),
    })),
    recentUsers: recentUserRows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.name,
      role: r.role,
      createdAt: Number(r.createdAt),
      onboarded: Number(r.onboarded ?? 0) === 1,
      auth:
        Number(r.google) === 1
          ? ("google" as const)
          : Number(r.hasPassword) === 1
            ? ("password" as const)
            : ("unknown" as const),
      xp: Number(r.xp ?? 0),
    })),
    topLearners: topLearnerRows.map((r) => ({
      userId: r.userId,
      name: r.name,
      email: r.email,
      xp: Number(r.xp),
      streak: Number(r.streak),
      lessonsTouched: Number(r.lessonsTouched),
    })),
  };
}
