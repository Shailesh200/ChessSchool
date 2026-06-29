import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { getCatalog } from "@/features/school/catalog.server";
import { nextLessonAfter } from "@/features/school/structure";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import type { Lesson, LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hw?: string }>;
}) {
  const { id } = await params;
  const { hw } = await searchParams;
  const row = (await db.select().from(lessons).where(eq(lessons.id, id)).limit(1))[0];
  if (!row) notFound();

  const lesson: Lesson = {
    id: row.id,
    unit: row.classId,
    title: row.title,
    subtitle: row.subtitle,
    emoji: row.emoji,
    prerequisites: JSON.parse(row.prerequisites) as string[],
    xp: row.xp,
    tag: row.tag,
    exam: row.isExam === 1,
    steps: JSON.parse(row.steps) as LessonStep[],
  };

  const catalog = await getCatalog();
  const nextLessonId = nextLessonAfter(id, catalog.allClasses);
  const owner = catalog.allClasses.find((c) => c.id === row.classId);
  const lessonClass = owner
    ? { id: owner.id, title: owner.title, lessonIds: owner.lessonIds }
    : undefined;

  return (
    <LessonPlayer
      lesson={lesson}
      nextLessonId={nextLessonId}
      lessonClass={lessonClass}
      homeworkStep={hw}
    />
  );
}
