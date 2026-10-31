import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { classes, lessons, homeworkLessons } from "@/db/schema";
import { buildClassExamSteps } from "@/features/school/classExam";
import type { LessonStep } from "@/features/lessons/types";
import {
  stripLessonStepsForClient,
  verifyLessonStepAnswer,
} from "@/lib/lesson-public";

export const dynamic = "force-dynamic";

function parseSteps(raw: string) {
  try {
    const steps = JSON.parse(raw);
    return Array.isArray(steps) ? (steps as LessonStep[]) : null;
  } catch {
    return null;
  }
}

async function loadLessonSteps(id: string): Promise<{
  steps: LessonStep[];
  meta: Record<string, unknown>;
} | null> {
  let row = (await db.select().from(lessons).where(eq(lessons.id, id)).limit(1))[0] as
    | {
        id: string;
        title: string;
        subtitle: string;
        emoji: string;
        tag: string;
        xp: number;
        steps: string;
        classId?: string | null;
        isExam?: boolean | number | null;
      }
    | undefined;
  if (!row) {
    row = (
      await db.select().from(homeworkLessons).where(eq(homeworkLessons.id, id)).limit(1)
    )[0];
  }
  if (row) {
    const steps = parseSteps(row.steps);
    if (!steps?.length) return null;
    return {
      steps,
      meta: {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle,
        emoji: row.emoji,
        tag: row.tag,
        xp: row.xp,
        classId: row.classId ?? null,
        exam: Boolean(row.isExam),
      },
    };
  }

  if (id.startsWith("exam-")) {
    const classId = id.slice("exam-".length);
    if (!classId.startsWith("class-")) return null;
    const cls = (
      await db.select().from(classes).where(eq(classes.id, classId)).limit(1)
    )[0];
    if (!cls) return null;

    const rows = await db
      .select({ id: lessons.id, steps: lessons.steps, isExam: lessons.isExam })
      .from(lessons)
      .where(eq(lessons.classId, classId))
      .orderBy(asc(lessons.sortOrder));
    const teaching = rows.filter((r) => !r.isExam);
    const examSteps = buildClassExamSteps(teaching);
    if (examSteps.length === 0) return null;

    return {
      steps: examSteps as LessonStep[],
      meta: {
        id,
        title: `${cls.title} — Quick Test`,
        subtitle: "Pass (≥70%) to graduate this class",
        emoji: "🎓",
        tag: "exam",
        xp: 60,
        classId,
        exam: true,
      },
    };
  }

  return null;
}

/** A single lesson (curriculum or homework) for the mobile Lesson Player. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadLessonSteps(id);
  if (!loaded) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({
    ...loaded.meta,
    steps: stripLessonStepsForClient(loaded.steps),
  });
}

const verifyBodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("move"),
    stepId: z.string().min(1).max(64),
    from: z.string().regex(/^[a-h][1-8]$/),
    to: z.string().regex(/^[a-h][1-8]$/),
    promotion: z.enum(["q", "r", "b", "n"]).optional(),
  }),
  z.object({
    kind: z.literal("quiz"),
    stepId: z.string().min(1).max(64),
    choice: z.number().int().min(0).max(20),
  }),
]);

/** Verify a lesson step answer without exposing solutions in GET payloads. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const loaded = await loadLessonSteps(id);
  if (!loaded) return NextResponse.json({ error: "not found" }, { status: 404 });

  const raw = await req.json().catch(() => null);
  const parsed = verifyBodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const step = loaded.steps.find((s) => s.id === parsed.data.stepId);
  if (!step) return NextResponse.json({ error: "unknown step" }, { status: 404 });

  const ok =
    parsed.data.kind === "quiz"
      ? verifyLessonStepAnswer(step, { kind: "quiz", choice: parsed.data.choice })
      : verifyLessonStepAnswer(step, {
          kind: "move",
          from: parsed.data.from,
          to: parsed.data.to,
          promotion: parsed.data.promotion,
        });

  return NextResponse.json({ ok });
}
