import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { progress, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LessonRec = { mastery: number; attempts: number; lastSeen: number; dueAt: number; incorrect?: number };

/** Everything beyond the typed columns lives in progress.data (JSON). */
interface ExtraData {
  rating?: number;
  botWins?: number;
  dailyGoalXp?: number;
  unlockedAchievements?: string[];
  schoolExamsPassed?: string[];
  weaknesses?: Record<string, number>;
  activityDays?: Record<string, number>;
  mistakeLog?: unknown[];
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
  recentGames?: unknown[];
  settings?: Record<string, unknown>;
}

/** Pull the account's saved progress (merged into / hydrated onto the client on login). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const p = (await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1))[0];
  const recs = await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id));
  const lessons: Record<string, LessonRec> = {};
  for (const r of recs) {
    lessons[r.lessonId] = { mastery: r.mastery, attempts: r.attempts, lastSeen: r.lastSeen, dueAt: r.dueAt };
  }
  let extra: ExtraData = {};
  try {
    extra = p?.data ? (JSON.parse(p.data) as ExtraData) : {};
  } catch {
    extra = {};
  }

  return NextResponse.json({
    user: { name: user.name, role: user.role },
    xp: p?.xp ?? 0,
    streak: p?.streak ?? 0,
    lastActiveDay: p?.lastActiveDay ?? null,
    graduatedClasses: p ? (JSON.parse(p.graduatedClasses) as string[]) : [],
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
    settings: extra.settings ?? null,
  });
}

interface PushBody {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  graduatedClasses: string[];
  lessons: Record<string, LessonRec>;
  rating?: number;
  botWins?: number;
  dailyGoalXp?: number;
  unlockedAchievements?: string[];
  schoolExamsPassed?: string[];
  weaknesses?: Record<string, number>;
  activityDays?: Record<string, number>;
  mistakeLog?: unknown[];
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
  recentGames?: unknown[];
  settings?: Record<string, unknown>;
}

/** Push the client's merged snapshot to the account. */
export async function POST(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as PushBody;
  const now = Date.now();
  // Merge over existing data so a client that omits a field (e.g. web doesn't
  // send recentGames) doesn't wipe it.
  const existing = (await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1))[0];
  let prev: ExtraData = {};
  try {
    prev = existing?.data ? (JSON.parse(existing.data) as ExtraData) : {};
  } catch {
    prev = {};
  }
  const incoming: ExtraData = {
    rating: body.rating,
    botWins: body.botWins,
    dailyGoalXp: body.dailyGoalXp,
    unlockedAchievements: body.unlockedAchievements,
    schoolExamsPassed: body.schoolExamsPassed,
    weaknesses: body.weaknesses,
    activityDays: body.activityDays,
    mistakeLog: body.mistakeLog,
    homeworkStreak: body.homeworkStreak,
    homeworkLastDay: body.homeworkLastDay,
    recentGames: body.recentGames,
    settings: body.settings,
  };
  const data: ExtraData = { ...prev };
  for (const [k, v] of Object.entries(incoming)) if (v !== undefined) (data as Record<string, unknown>)[k] = v;
  const row = {
    xp: body.xp,
    streak: body.streak,
    lastActiveDay: body.lastActiveDay,
    graduatedClasses: JSON.stringify(body.graduatedClasses ?? []),
    dailyGoalXp: body.dailyGoalXp ?? 50,
    data: JSON.stringify(data),
    updatedAt: now,
  };

  await db
    .insert(progress)
    .values({ userId: user.id, ...row })
    .onConflictDoUpdate({ target: progress.userId, set: row });

  // The snapshot is the full client union, so replace the user's records.
  await db.delete(lessonRecords).where(eq(lessonRecords.userId, user.id));
  const rows = Object.entries(body.lessons ?? {}).map(([lessonId, r]) => ({
    id: `${user.id}:${lessonId}`,
    userId: user.id,
    lessonId,
    mastery: r.mastery,
    attempts: r.attempts,
    lastSeen: r.lastSeen,
    dueAt: r.dueAt,
  }));
  for (let i = 0; i < rows.length; i += 200) {
    await db.insert(lessonRecords).values(rows.slice(i, i + 200));
  }

  return NextResponse.json({ ok: true, count: rows.length });
}
