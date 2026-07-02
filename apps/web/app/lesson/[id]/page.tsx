import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons } from "@/db/schema";
import { getCatalog } from "@/features/school/catalog.server";
import { nextLessonAfter } from "@/features/school/structure";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";
import { JsonLd } from "@/components/seo/JsonLd";
import { canonical, lessonDescription, siteName, siteUrl, socialMeta } from "@/lib/seo";
import type { Lesson, LessonStep } from "@/features/lessons/types";

export const revalidate = 3600;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const row = (
    await db
      .select({ title: lessons.title, subtitle: lessons.subtitle, emoji: lessons.emoji })
      .from(lessons)
      .where(eq(lessons.id, id))
      .limit(1)
  )[0];
  if (!row) return { title: "Lesson" };
  const title = row.title;
  const description = lessonDescription(title, row.subtitle);
  return {
    title,
    description,
    ...socialMeta({
      title: `${row.emoji} ${title}`,
      description,
      path: `/lesson/${id}`,
      kind: "lesson",
      emoji: row.emoji,
      badge: "Chess Lesson",
      imageTitle: title,
      imageSubtitle: description,
    }),
  };
}

export default async function LessonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ hw?: string; daily?: string }>;
}) {
  const { id } = await params;
  const { hw, daily } = await searchParams;
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
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "LearningResource",
          name: lesson.title,
          description: lessonDescription(lesson.title, lesson.subtitle),
          url: canonical(`/lesson/${lesson.id}`),
          isPartOf: { "@type": "WebSite", name: siteName, url: siteUrl },
          learningResourceType: lesson.exam ? "Assessment" : "Interactive exercise",
          educationalLevel: owner?.title ?? lesson.unit,
        }}
      />
      <LessonPlayer
        lesson={lesson}
        nextLessonId={nextLessonId}
        lessonClass={lessonClass}
        homeworkStep={hw}
        dailyPuzzle={daily === "1"}
      />
    </>
  );
}
