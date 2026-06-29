import { NextResponse } from "next/server";
import { db } from "@/db";
import { homeworkLessons } from "@/db/schema";

// Homework pool changes only when re-seeded.
export const revalidate = 3600;

/** The dedicated homework lessons, grouped by routine type (client rotates by day). */
export async function GET() {
  const rows = await db
    .select({ id: homeworkLessons.id, type: homeworkLessons.type, title: homeworkLessons.title })
    .from(homeworkLessons)
    .orderBy(homeworkLessons.type, homeworkLessons.sortOrder);
  const byType: Record<string, { id: string; title: string }[]> = {};
  for (const r of rows) (byType[r.type] ??= []).push({ id: r.id, title: r.title });
  return NextResponse.json({ byType });
}
