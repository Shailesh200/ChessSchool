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

export type AdminAnalytics = {
  generatedAt: number;
  users: {
    total: number;
    students: number;
    admins: number;
    withGoogle: number;
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
  events: { name: string; count: number }[];
  signupsByDay: { day: string; count: number }[];
  topLessons: {
    lessonId: string;
    title: string;
    learners: number;
    attempts: number;
    mastered: number;
  }[];
  activity: {
    activeLast7d: number;
    totalXp: number;
    avgStreak: number;
  };
};

function sinceMs(days: number): number {
  return Date.now() - days * DAY_MS;
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
    eventRows,
    signupRows,
    topRows,
    [activity],
  ] = await Promise.all([
    conn.select({ n: count() }).from(users),
    conn.select({ n: count() }).from(users).where(eq(users.role, "student")),
    conn.select({ n: count() }).from(users).where(eq(users.role, "admin")),
    conn
      .select({ n: sql<number>`count(distinct ${oauthAccounts.userId})` })
      .from(oauthAccounts)
      .where(eq(oauthAccounts.provider, "google")),
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
        name: analyticsEvents.name,
        count: count(),
      })
      .from(analyticsEvents)
      .groupBy(analyticsEvents.name)
      .orderBy(desc(count()))
      .limit(20),
    conn
      .select({
        day: sql<string>`date(${users.createdAt} / 1000, 'unixepoch')`,
        count: count(),
      })
      .from(users)
      .where(gte(users.createdAt, d30))
      .groupBy(sql`date(${users.createdAt} / 1000, 'unixepoch')`)
      .orderBy(sql`date(${users.createdAt} / 1000, 'unixepoch')`),
    conn
      .select({
        lessonId: lessonRecords.lessonId,
        title: sql<string>`coalesce(${lessons.title}, ${lessonRecords.lessonId})`,
        learners: count(),
        attempts: sql<number>`coalesce(sum(${lessonRecords.attempts}), 0)`,
        mastered: sql<number>`sum(case when ${lessonRecords.mastery} >= ${MASTERED} then 1 else 0 end)`,
      })
      .from(lessonRecords)
      .leftJoin(lessons, eq(lessonRecords.lessonId, lessons.id))
      .groupBy(lessonRecords.lessonId, lessons.title)
      .orderBy(desc(sum(lessonRecords.attempts)))
      .limit(12),
    conn
      .select({
        activeUsers: sql<number>`count(distinct case when ${lessonRecords.lastSeen} >= ${d7} then ${lessonRecords.userId} end)`,
      })
      .from(lessonRecords),
  ]);

  const [xpRow] = await conn
    .select({
      totalXp: sql<number>`coalesce(sum(${progress.xp}), 0)`,
      avgStreak: sql<number>`coalesce(avg(${progress.streak}), 0)`,
    })
    .from(progress);

  const activeUsers = Number(activity?.activeUsers ?? 0);

  return {
    generatedAt: now,
    users: {
      total: Number(userTotal?.n ?? 0),
      students: Number(studentTotal?.n ?? 0),
      admins: Number(adminTotal?.n ?? 0),
      withGoogle: Number(googleTotal?.n ?? 0),
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
    events: eventRows.map((r) => ({
      name: r.name,
      count: Number(r.count),
    })),
    signupsByDay: signupRows.map((r) => ({
      day: r.day,
      count: Number(r.count),
    })),
    topLessons: topRows.map((r) => ({
      lessonId: r.lessonId,
      title: r.title,
      learners: Number(r.learners),
      attempts: Number(r.attempts),
      mastered: Number(r.mastered),
    })),
    activity: {
      activeLast7d: activeUsers,
      totalXp: Math.round(Number(xpRow?.totalXp ?? 0)),
      avgStreak: Math.round(Number(xpRow?.avgStreak ?? 0) * 10) / 10,
    },
  };
}
