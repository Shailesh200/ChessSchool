import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { progress, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { progressPushSchema } from "@/lib/api-schemas";
import { parseExtraData, parseGraduatedClasses } from "@/lib/progress-merge";
import { applyProgressPush } from "@/lib/progress-server";
import type { LibSQLDatabase } from "drizzle-orm/libsql";
import type * as schema from "@/db/schema";

export const dynamic = "force-dynamic";

type LessonRec = {
  mastery: number;
  attempts: number;
  lastSeen: number;
  dueAt: number;
  incorrect?: number;
};

/** Pull the account's saved progress (merged into / hydrated onto the client on login). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const p = (
    await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1)
  )[0];
  const recs = await db
    .select()
    .from(lessonRecords)
    .where(eq(lessonRecords.userId, user.id));
  const lessons: Record<string, LessonRec> = {};
  for (const r of recs) {
    lessons[r.lessonId] = {
      mastery: r.mastery,
      attempts: r.attempts,
      lastSeen: r.lastSeen,
      dueAt: r.dueAt,
    };
  }
  const extra = parseExtraData(p?.data);
  const graduatedClasses = parseGraduatedClasses(p?.graduatedClasses);

  return NextResponse.json({
    user: { name: user.name, role: user.role },
    xp: p?.xp ?? 0,
    streak: p?.streak ?? 0,
    lastActiveDay: p?.lastActiveDay ?? null,
    graduatedClasses,
    lessons,
    rating: extra.rating ?? 800,
    botWins: extra.botWins ?? 0,
    dailyGoalXp: extra.dailyGoalXp ?? p?.dailyGoalXp ?? 50,
    unlockedAchievements: extra.unlockedAchievements ?? [],
    schoolExamsPassed: extra.schoolExamsPassed ?? [],
    weaknesses: extra.weaknesses ?? {},
    activityDays: extra.activityDays ?? {},
    mistakeLog: extra.mistakeLog ?? [],
    homeworkStreak: extra.homeworkStreak ?? 0,
    homeworkLastDay: extra.homeworkLastDay ?? null,
    recentGames: extra.recentGames ?? [],
    dailyPuzzleDay: extra.dailyPuzzleDay ?? null,
    settings: extra.settings ?? null,
    homeworkDone: extra.homeworkDone ?? {},
    placementDone: extra.placementDone ?? false,
    journalEntries: extra.journalEntries ?? [],
  });
}

/** Push the client's snapshot — max-merged with server state in a transaction. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const raw = await req.json().catch(() => null);
  const parsed = progressPushSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid body", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { lessonCount } = await applyProgressPush(
    user.id,
    parsed.data,
    db as LibSQLDatabase<typeof schema>,
  );
  return NextResponse.json({ ok: true, count: lessonCount });
}
