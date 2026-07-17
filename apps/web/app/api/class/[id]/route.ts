import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { classes, lessons, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { STAGES } from "@/content/school";
import { isOptionalStage, orderClasses } from "@/lib/school-order";
import { parseExtraData } from "@/lib/progress-merge";
import { getCurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

export const dynamic = "force-dynamic";

const STAGE_ORDER = STAGES.map((s) => s.id);

function stageOfSemester(
  semId: string,
  semById: Map<string, { stage: string }>,
): string {
  return semById.get(semId)?.stage ?? "";
}

function computeUnlocked(
  ordered: { id: string; semesterId: string }[],
  semById: Map<string, { stage: string }>,
  classDone: (id: string) => boolean,
): Map<string, boolean> {
  const byStage = new Map<string, string[]>();
  for (const c of ordered) {
    const stage = stageOfSemester(c.semesterId, semById);
    const arr = byStage.get(stage) ?? [];
    arr.push(c.id);
    byStage.set(stage, arr);
  }

  const map = new Map<string, boolean>();
  let lastRequiredDone = true;

  for (const stageId of STAGE_ORDER) {
    const ids = byStage.get(stageId) ?? [];
    if (isOptionalStage(stageId)) {
      ids.forEach((cid, i) => map.set(cid, i === 0 || classDone(ids[i - 1]!)));
      continue;
    }
    for (let i = 0; i < ids.length; i++) {
      map.set(ids[i]!, lastRequiredDone && (i === 0 || classDone(ids[i - 1]!)));
    }
    if (ids.length > 0) lastRequiredDone = classDone(ids[ids.length - 1]!);
  }
  return map;
}

/** A class header + its lessons (+ exam) for the mobile Journey view. */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const cls = (await db.select().from(classes).where(eq(classes.id, id)).limit(1))[0];
  if (!cls) return NextResponse.json({ error: "not found" }, { status: 404 });

  const rows = await db
    .select({
      id: lessons.id,
      title: lessons.title,
      subtitle: lessons.subtitle,
      emoji: lessons.emoji,
      tag: lessons.tag,
      sortOrder: lessons.sortOrder,
      isExam: lessons.isExam,
      prerequisites: lessons.prerequisites,
    })
    .from(lessons)
    .where(eq(lessons.classId, id));
  rows.sort((a, b) => a.sortOrder - b.sortOrder);

  const main = rows
    .filter((r) => !r.isExam)
    .map((r) => ({
      id: r.id,
      title: r.title,
      subtitle: r.subtitle,
      emoji: r.emoji,
      prerequisites: JSON.parse(r.prerequisites || "[]") as string[],
    }));
  let exam: { id: string; title: string } | null = null;
  if (cls.examId) {
    const ex = rows.find((r) => r.id === cls.examId);
    if (ex) exam = { id: ex.id, title: ex.title };
  }

  const user = await getApiUser(req);
  let unlocked = true;
  if (user) {
    const {
      semesters: sems,
      classes: allCls,
      lessons: les,
    } = await getCurriculumSkeleton();
    const mastery: Record<string, number> = {};
    for (const r of await db
      .select({ lessonId: lessonRecords.lessonId, mastery: lessonRecords.mastery })
      .from(lessonRecords)
      .where(eq(lessonRecords.userId, user.id)))
      mastery[r.lessonId] = r.mastery;

    const counts: Record<string, { done: number; total: number }> = {};
    for (const l of les) {
      const c = (counts[l.classId] ??= { done: 0, total: 0 });
      c.total++;
      if ((mastery[l.id] ?? 0) >= 0.9) c.done++;
    }
    const semById = new Map(sems.map((s) => [s.id, s]));
    const classDone = (cid: string) => {
      const c = counts[cid];
      return !!c && c.total > 0 && c.done >= c.total;
    };
    const ordered = orderClasses(
      sems.map((s) => ({
        id: s.id,
        stage: s.stage,
        sortOrder: s.sortOrder,
        title: s.title,
      })),
      allCls.map((c) => ({
        id: c.id,
        semesterId: c.semesterId,
        sortOrder: c.sortOrder,
        title: c.title,
      })),
    );
    unlocked = computeUnlocked(ordered, semById, classDone).get(id) ?? false;
  }

  return NextResponse.json({
    class: {
      id: cls.id,
      title: cls.title,
      emoji: cls.emoji,
      blurb: cls.blurb,
      examId: cls.examId ?? null,
    },
    lessons: main,
    exam,
    unlocked,
  });
}
