import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons } from "@/db/schema";

export const dynamic = "force-dynamic";

/** A class header + its lessons (+ exam) for the mobile Journey view. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cls = (await db.select().from(classes).where(eq(classes.id, id)).limit(1))[0];
  if (!cls) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await db
    .select({ id: lessons.id, title: lessons.title, subtitle: lessons.subtitle, emoji: lessons.emoji, tag: lessons.tag, sortOrder: lessons.sortOrder, isExam: lessons.isExam })
    .from(lessons)
    .where(eq(lessons.classId, id));
  rows.sort((a, b) => a.sortOrder - b.sortOrder);

  const main = rows.filter((r) => !r.isExam).map((r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, emoji: r.emoji }));
  let exam: { id: string; title: string } | null = null;
  if (cls.examId) {
    const ex = rows.find((r) => r.id === cls.examId);
    if (ex) exam = { id: ex.id, title: ex.title };
  }

  return NextResponse.json({
    class: { id: cls.id, title: cls.title, emoji: cls.emoji, blurb: cls.blurb, examId: cls.examId ?? null },
    lessons: main,
    exam,
  });
}
