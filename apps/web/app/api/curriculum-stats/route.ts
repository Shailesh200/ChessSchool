import { NextResponse } from "next/server";
import { db } from "@/db";
import { classes, lessons } from "@/db/schema";

// Cached — curriculum size changes only when admins edit content.
export const revalidate = 3600;

/** Public curriculum totals so the client dashboard computes against real data. */
export async function GET() {
  const [cls, les] = await Promise.all([
    db.select({ id: classes.id }).from(classes),
    db.select({ id: lessons.id, tag: lessons.tag }).from(lessons),
  ]);
  const lessonsByTag: Record<string, string[]> = {};
  for (const l of les) (lessonsByTag[l.tag] ??= []).push(l.id);
  return NextResponse.json({ totalClasses: cls.length, totalLessons: les.length, lessonsByTag });
}
