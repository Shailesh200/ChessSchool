import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import type { Lesson, LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

export default async function LibraryLessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
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

  return <LessonPlayer lesson={lesson} />;
}
