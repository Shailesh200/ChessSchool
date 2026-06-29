import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** The student's next lesson + breadcrumb, for the mobile Resume card. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, semesterId: classes.semesterId, sortOrder: classes.sortOrder }).from(classes),
    db.select({ id: lessons.id, title: lessons.title, classId: lessons.classId, sortOrder: lessons.sortOrder }).from(lessons),
  ]);
  const mastery: Record<string, number> = {};
  if (user) {
    for (const r of await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id))) {
      mastery[r.lessonId] = r.mastery;
    }
  }
  const semOrder = new Map(sems.map((s) => [s.id, s.sortOrder]));
  const semTitle = new Map(sems.map((s) => [s.id, s.title]));
  const orderedClasses = [...cls].sort(
    (a, b) => (semOrder.get(a.semesterId) ?? 0) - (semOrder.get(b.semesterId) ?? 0) || a.sortOrder - b.sortOrder,
  );
  const byClass = new Map<string, typeof les>();
  for (const l of les) {
    if (!byClass.has(l.classId)) byClass.set(l.classId, []);
    byClass.get(l.classId)!.push(l);
  }

  for (let i = 0; i < orderedClasses.length; i++) {
    const c = orderedClasses[i]!;
    const classLessons = (byClass.get(c.id) ?? []).sort((a, b) => a.sortOrder - b.sortOrder);
    if (!classLessons.length) continue;
    const done = classLessons.filter((l) => (mastery[l.id] ?? 0) >= 0.9).length;
    const next = classLessons.find((l) => (mastery[l.id] ?? 0) < 0.9);
    if (next) {
      return NextResponse.json({
        complete: false,
        lessonId: next.id,
        lessonTitle: next.title,
        className: c.title,
        semesterTitle: (semTitle.get(c.semesterId) ?? "").split("·")[0]!.trim(),
        classIndex: i + 1,
        totalClasses: orderedClasses.length,
        done,
        total: classLessons.length,
      });
    }
  }
  return NextResponse.json({ complete: true });
}
