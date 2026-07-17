import { NextResponse } from "next/server";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

export const revalidate = 3600;

/** Public curriculum totals so the client dashboard computes against real data. */
export async function GET() {
  const { classes: cls, lessons: les } = await getCurriculumSkeleton();
  const lessonsByTag: Record<string, string[]> = {};
  for (const l of les) (lessonsByTag[l.tag] ??= []).push(l.id);
  return NextResponse.json({
    totalClasses: cls.length,
    totalLessons: les.length,
    lessonsByTag,
  });
}
