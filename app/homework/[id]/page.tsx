import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkLessons } from "@/db/schema";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import type { Lesson, LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

/** A dedicated homework lesson (separate pool from the school curriculum). */
export default async function HomeworkLessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hw?: string }>;
}) {
  const { id } = await params;
  const { hw } = await searchParams;
  const row = (await db.select().from(homeworkLessons).where(eq(homeworkLessons.id, id)).limit(1))[0];
  if (!row) notFound();

  const lesson: Lesson = {
    id: row.id,
    unit: "homework",
    title: row.title,
    subtitle: row.subtitle,
    emoji: row.emoji,
    prerequisites: [],
    xp: row.xp,
    tag: row.tag,
    exam: false,
    steps: JSON.parse(row.steps) as LessonStep[],
  };

  // Completing it checks off the routine step it was launched from (defaults to its type).
  return <LessonPlayer lesson={lesson} nextLessonId={null} homeworkStep={hw ?? row.type} />;
}
