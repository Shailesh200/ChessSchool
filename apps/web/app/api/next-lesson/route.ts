import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { orderClasses, shouldSkipSemester } from "@/lib/school-order";

export const dynamic = "force-dynamic";

/** The student's next lesson + breadcrumb (web ResumeCard + mobile Learn tab). */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, stage: semesters.stage, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, semesterId: classes.semesterId, sortOrder: classes.sortOrder }).from(classes),
    db.select({ id: lessons.id, title: lessons.title, classId: lessons.classId, sortOrder: lessons.sortOrder, isExam: lessons.isExam }).from(lessons),
  ]);

  const mastery: Record<string, number> = {};
  if (user) {
    for (const r of await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id))) {
      mastery[r.lessonId] = r.mastery;
    }
  }

  const semTitle = new Map(sems.map((s) => [s.id, s.title]));
  const lessonClassById = new Map(les.map((l) => [l.id, l.classId]));
  const byClass = new Map<string, typeof les>();
  for (const l of les) {
    if (l.isExam) continue;
    if (!byClass.has(l.classId)) byClass.set(l.classId, []);
    byClass.get(l.classId)!.push(l);
  }

  const orderedClasses = orderClasses(sems, cls);
  const semClassIds = new Map<string, string[]>();
  for (const c of orderedClasses) {
    const arr = semClassIds.get(c.semesterId) ?? [];
    arr.push(c.id);
    semClassIds.set(c.semesterId, arr);
  }

  let classIndex = 0;
  for (const c of orderedClasses) {
    classIndex++;
    const sem = sems.find((s) => s.id === c.semesterId);
    if (sem && shouldSkipSemester(sem, semClassIds.get(sem.id) ?? [], mastery, lessonClassById)) {
      continue;
    }

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
        classIndex,
        totalClasses: orderedClasses.length,
        done,
        total: classLessons.length,
      });
    }
  }

  return NextResponse.json({ complete: true });
}
