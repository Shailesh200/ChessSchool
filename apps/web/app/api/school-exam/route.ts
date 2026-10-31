import { NextResponse } from "next/server";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { lessons, classes, semesters } from "@/db/schema";
import { stripLessonStepsForClient } from "@/lib/lesson-public";
import {
  pickSchoolExamSteps,
  SCHOOL_EXAM_STEP_COUNT,
} from "@/features/school/classExam";
import type { LessonStep } from "@/features/lessons/types";

export const dynamic = "force-dynamic";

/**
 * A school exam: ~8 random single-move puzzles drawn from across a stage's
 * lessons, in random order (?stage=elementary). Used to unlock the next school.
 */
export async function GET(req: Request) {
  const stage = new URL(req.url).searchParams.get("stage") ?? "elementary";
  const sems = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(eq(semesters.stage, stage));
  const semIds = sems.map((s) => s.id);
  if (!semIds.length) return NextResponse.json({ steps: [] });
  const cls = await db
    .select({ id: classes.id })
    .from(classes)
    .where(inArray(classes.semesterId, semIds));
  const clsIds = cls.map((c) => c.id);
  if (!clsIds.length) return NextResponse.json({ steps: [] });
  // Sample random lessons (not all — a stage can have thousands).
  const les = await db
    .select({ steps: lessons.steps })
    .from(lessons)
    .where(inArray(lessons.classId, clsIds))
    .orderBy(sql`RANDOM()`)
    .limit(80);

  const moveSteps: LessonStep[] = [];
  for (const l of les) {
    try {
      for (const s of JSON.parse(l.steps) as LessonStep[]) {
        if (s.kind === "move") moveSteps.push(s);
      }
    } catch {
      /* skip */
    }
  }
  const steps = pickSchoolExamSteps(moveSteps, SCHOOL_EXAM_STEP_COUNT).map((s, i) => ({
    ...s,
    id: `ex${i}`,
    tag: "exam",
  }));
  return NextResponse.json({ steps: stripLessonStepsForClient(steps) });
}
