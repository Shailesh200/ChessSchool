import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { lessons, homeworkLessons } from "@/db/schema";

export const dynamic = "force-dynamic";

/** A single lesson (curriculum or homework) for the mobile Lesson Player. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let row = (await db.select().from(lessons).where(eq(lessons.id, id)).limit(1))[0] as
    | { id: string; title: string; subtitle: string; emoji: string; tag: string; xp: number; steps: string }
    | undefined;
  if (!row) {
    // Homework lessons live in a separate table.
    row = (await db.select().from(homeworkLessons).where(eq(homeworkLessons.id, id)).limit(1))[0];
  }
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json({
    id: row.id,
    title: row.title,
    subtitle: row.subtitle,
    emoji: row.emoji,
    tag: row.tag,
    xp: row.xp,
    steps: JSON.parse(row.steps),
  });
}
