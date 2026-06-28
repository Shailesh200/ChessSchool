import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { progress, lessonRecords } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Pull the account's saved progress (used to merge into the client on login). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const p = (await db.select().from(progress).where(eq(progress.userId, user.id)).limit(1))[0];
  const recs = await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id));
  const lessons: Record<string, { mastery: number; attempts: number; lastSeen: number; dueAt: number }> = {};
  for (const r of recs) {
    lessons[r.lessonId] = { mastery: r.mastery, attempts: r.attempts, lastSeen: r.lastSeen, dueAt: r.dueAt };
  }

  return NextResponse.json({
    user: { name: user.name, role: user.role },
    xp: p?.xp ?? 0,
    streak: p?.streak ?? 0,
    lastActiveDay: p?.lastActiveDay ?? null,
    graduatedClasses: p ? (JSON.parse(p.graduatedClasses) as string[]) : [],
    lessons,
  });
}

interface PushBody {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  graduatedClasses: string[];
  lessons: Record<string, { mastery: number; attempts: number; lastSeen: number; dueAt: number }>;
}

/** Push the client's merged snapshot to the account. */
export async function POST(req: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json()) as PushBody;
  const now = Date.now();

  await db
    .insert(progress)
    .values({
      userId: user.id,
      xp: body.xp,
      streak: body.streak,
      lastActiveDay: body.lastActiveDay,
      graduatedClasses: JSON.stringify(body.graduatedClasses ?? []),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: progress.userId,
      set: {
        xp: body.xp,
        streak: body.streak,
        lastActiveDay: body.lastActiveDay,
        graduatedClasses: JSON.stringify(body.graduatedClasses ?? []),
        updatedAt: now,
      },
    });

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
