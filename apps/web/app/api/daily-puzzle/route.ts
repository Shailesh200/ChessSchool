import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { homeworkLessons } from "@/db/schema";
import { dailyPuzzleId, resolveRequestedDay } from "@chess-school/progression";

export const revalidate = 3600;

/** Deterministic daily puzzle from the homework practice pool. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const day = resolveRequestedDay(url.searchParams.get("day"));
  if (day === null) {
    return NextResponse.json({ error: "invalid_day" }, { status: 400 });
  }

  const rows = await db
    .select({
      id: homeworkLessons.id,
      title: homeworkLessons.title,
      tag: homeworkLessons.tag,
      emoji: homeworkLessons.emoji,
    })
    .from(homeworkLessons)
    .where(eq(homeworkLessons.type, "practice"))
    .orderBy(asc(homeworkLessons.sortOrder));

  const pool = rows.map((r) => r.id);
  const lessonId = dailyPuzzleId(pool, day);
  const picked = rows.find((r) => r.id === lessonId) ?? rows[0];

  if (!picked) {
    return NextResponse.json({
      day,
      lessonId: null,
      title: null,
      tag: null,
      emoji: null,
    });
  }

  return NextResponse.json({
    day,
    lessonId: picked.id,
    title: picked.title,
    tag: picked.tag,
    emoji: picked.emoji,
  });
}
