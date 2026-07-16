import { NextResponse } from "next/server";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

export const revalidate = 3600;

/** First curriculum lesson matching a weakness tag — for mobile Review recommendations. */
export async function GET(req: Request) {
  const tag = new URL(req.url).searchParams.get("tag")?.trim();
  if (!tag) return NextResponse.json({ lesson: null });

  const { lessons } = await getCurriculumSkeleton();
  const lesson = lessons.find((l) => l.tag === tag);
  if (!lesson) return NextResponse.json({ lesson: null });

  return NextResponse.json({
    lesson: { id: lesson.id, title: lesson.title, emoji: lesson.emoji, tag: lesson.tag },
  });
}
