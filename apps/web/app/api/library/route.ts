import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons, classes, semesters, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The student's completed (mastered) lessons, grouped by semester — for the mobile Library. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  if (!user) return NextResponse.json({ groups: [] });

  const recs = await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id));
  const doneIds = new Set(recs.filter((r) => r.mastery >= 0.9).map((r) => r.lessonId));
  if (doneIds.size === 0) return NextResponse.json({ groups: [] });

  const [les, cls, sems] = await Promise.all([
    db.select({ id: lessons.id, title: lessons.title, emoji: lessons.emoji, classId: lessons.classId }).from(lessons),
    db.select({ id: classes.id, semesterId: classes.semesterId }).from(classes),
    db.select({ id: semesters.id, title: semesters.title, sortOrder: semesters.sortOrder }).from(semesters),
  ]);
  const classSem = new Map(cls.map((c) => [c.id, c.semesterId]));
  const semTitle = new Map(sems.map((s) => [s.id, s.title]));
  const semOrder = new Map(sems.map((s) => [s.id, s.sortOrder]));

  const bySem: Record<string, { id: string; title: string; emoji: string }[]> = {};
  for (const l of les) {
    if (!doneIds.has(l.id)) continue;
    const semId = classSem.get(l.classId) ?? "other";
    (bySem[semId] ??= []).push({ id: l.id, title: l.title, emoji: l.emoji });
  }
  const groups = Object.entries(bySem)
    .map(([semId, items]) => ({ semester: semTitle.get(semId) ?? "Other", order: semOrder.get(semId) ?? 999, lessons: items }))
    .sort((a, b) => a.order - b.order);

  return NextResponse.json({ groups });
}
