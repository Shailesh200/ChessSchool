import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons, semesters } from "@/db/schema";

// Cached — structure changes only when admins edit content.
export const revalidate = 3600;

/** Class → non-exam lesson ids (+ titles), so the client builds the report card. */
export async function GET() {
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, stage: semesters.stage }).from(semesters),
    db
      .select({ id: classes.id, title: classes.title, emoji: classes.emoji, semesterId: classes.semesterId })
      .from(classes)
      .orderBy(asc(classes.sortOrder)),
    db
      .select({ id: lessons.id, classId: lessons.classId, isExam: lessons.isExam })
      .from(lessons)
      .orderBy(asc(lessons.sortOrder)),
  ]);
  const semById = new Map(sems.map((s) => [s.id, s]));
  const idsByClass: Record<string, string[]> = {};
  for (const l of les) {
    if (l.isExam) continue;
    (idsByClass[l.classId] ??= []).push(l.id);
  }
  const out = cls.map((c) => ({
    id: c.id,
    title: c.title,
    emoji: c.emoji,
    semesterTitle: semById.get(c.semesterId)?.title ?? "",
    stage: semById.get(c.semesterId)?.stage ?? "elementary",
    lessonIds: idsByClass[c.id] ?? [],
  }));
  return NextResponse.json({ classes: out });
}
