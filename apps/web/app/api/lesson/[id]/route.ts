import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons, homeworkLessons } from "@/db/schema";

export const dynamic = "force-dynamic";

function sample<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr;
  const step = arr.length / n;
  return Array.from({ length: n }, (_, i) => arr[Math.floor(i * step)]!);
}

function parseSteps(raw: string) {
  try {
    const steps = JSON.parse(raw);
    return Array.isArray(steps) ? steps : null;
  } catch {
    return null;
  }
}

/** A single lesson (curriculum or homework) for the mobile Lesson Player. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  // DB first — real exam lesson ids like `exam-pieces` must not hit the synthetic branch.
  let row = (await db.select().from(lessons).where(eq(lessons.id, id)).limit(1))[0] as
    | { id: string; title: string; subtitle: string; emoji: string; tag: string; xp: number; steps: string; classId?: string | null; isExam?: boolean | number | null }
    | undefined;
  if (!row) {
    row = (await db.select().from(homeworkLessons).where(eq(homeworkLessons.id, id)).limit(1))[0];
  }
  if (row) {
    const steps = parseSteps(row.steps);
    if (!steps?.length) return NextResponse.json({ error: "invalid lesson" }, { status: 500 });
    return NextResponse.json({
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      emoji: row.emoji,
      tag: row.tag,
      xp: row.xp,
      classId: row.classId ?? null,
      exam: Boolean(row.isExam),
      steps,
    });
  }

  // Synthetic class test-out: `exam-class-pieces` (class id = class-pieces).
  if (id.startsWith("exam-")) {
    const classId = id.slice("exam-".length);
    if (!classId.startsWith("class-")) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    const cls = (await db.select().from(classes).where(eq(classes.id, classId)).limit(1))[0];
    if (!cls) return NextResponse.json({ error: "not found" }, { status: 404 });

    const rows = await db
      .select({ id: lessons.id, steps: lessons.steps, isExam: lessons.isExam })
      .from(lessons)
      .where(eq(lessons.classId, classId))
      .orderBy(asc(lessons.sortOrder));
    const teaching = rows.filter((r) => !r.isExam);
    const recent = teaching.slice(-2);
    const moveSteps = (recent.length ? recent : teaching).flatMap((r) => {
      const parsed = parseSteps(r.steps);
      return parsed ? parsed.filter((s: { kind: string }) => s.kind === "move") : [];
    });
    if (moveSteps.length === 0) return NextResponse.json({ error: "not found" }, { status: 404 });

    return NextResponse.json({
      id,
      title: `${cls.title} — Quick Test`,
      subtitle: "Pass (≥70%) to graduate this class",
      emoji: "🎓",
      tag: "exam",
      xp: 60,
      classId,
      exam: true,
      steps: sample(moveSteps, 5),
    });
  }

  return NextResponse.json({ error: "not found" }, { status: 404 });
}
