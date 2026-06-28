import { notFound } from "next/navigation";
import { getLesson, LESSONS } from "@/features/lessons/curriculum";
import { LessonPlayer } from "@/features/lessons/LessonPlayer";

export function generateStaticParams() {
  return LESSONS.map((l) => ({ id: l.id }));
}

export default async function LessonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const lesson = getLesson(id);
  if (!lesson) notFound();
  return <LessonPlayer lesson={lesson} />;
}
