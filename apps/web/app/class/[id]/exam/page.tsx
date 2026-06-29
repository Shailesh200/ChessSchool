import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes as classT, lessons as lessonT } from "@/db/schema";
import { getCatalog } from "@/features/school/catalog.server";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import type { Lesson, LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

/** Evenly sample up to `n` items across the array. */
function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]!);
}

/** Generic "test out of this class" exam (#12) — built from the class's drills. */
export default async function ClassExamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const clsRow = (await db.select().from(classT).where(eq(classT.id, id)).limit(1))[0];
  if (!clsRow) notFound();

  const rows = await db
    .select({ id: lessonT.id, steps: lessonT.steps, isExam: lessonT.isExam })
    .from(lessonT)
    .where(eq(lessonT.classId, id))
    .orderBy(asc(lessonT.sortOrder));
  const teaching = rows.filter((r) => !r.isExam);
  const lessonIds = teaching.map((r) => r.id);
  // Test the most-recent lessons (the material just before this point), not the
  // whole class from the start — a short, quick check.
  const recent = teaching.slice(-2);
  const moveSteps = (recent.length ? recent : teaching)
    .flatMap((r) => (JSON.parse(r.steps) as LessonStep[]).filter((s) => s.kind === "move"));
  if (moveSteps.length === 0) notFound();

  const exam: Lesson = {
    id: `exam-${id}`,
    unit: id,
    title: `${clsRow.title} — Quick Test`,
    subtitle: "Pass (≥67%) to graduate this class",
    emoji: "🎓",
    prerequisites: [],
    xp: 60,
    tag: "exam",
    exam: true,
    steps: sample(moveSteps, 5),
  };

  // After passing, continue to the next class's first lesson.
  const catalog = await getCatalog();
  const idx = catalog.allClasses.findIndex((c) => c.id === id);
  const nextLessonId = catalog.allClasses[idx + 1]?.lessonIds[0] ?? null;

  return (
    <LessonPlayer
      lesson={exam}
      nextLessonId={nextLessonId}
      lessonClass={{ id, title: clsRow.title, lessonIds }}
    />
  );
}
