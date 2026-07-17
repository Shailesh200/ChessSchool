import { NextResponse } from "next/server";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

export const revalidate = 3600;

/** Light catalog for mobile browsing: semesters + their classes (no lesson bodies). */
export async function GET() {
  const { semesters: sems, classes: cls } = await getCurriculumSkeleton();
  return NextResponse.json({ semesters: sems, classes: cls });
}
