import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons, lessonRecords, progress } from "@/db/schema";
import { getApiUser } from "@/lib/auth";
import { STAGES } from "@/content/school";
import { isOptionalStage, orderClasses } from "@/lib/school-order";

export const dynamic = "force-dynamic";

const STAGE_ORDER = STAGES.map((s) => s.id);
const STAGE_META = Object.fromEntries(
  STAGES.map((s) => [s.id, { name: s.name, emoji: s.emoji, blurb: s.blurb, optional: Boolean(s.optional) }]),
);

function stageOfSemester(semId: string, semById: Map<string, { stage: string }>): string {
  return semById.get(semId)?.stage ?? "";
}

/** Class unlock: optional stages are internal-only; required track skips optional predecessors. */
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
      ids.forEach((id, i) => map.set(id, i === 0 || classDone(ids[i - 1]!)));
      continue;
    }
    for (let i = 0; i < ids.length; i++) {
      map.set(ids[i]!, lastRequiredDone && (i === 0 || classDone(ids[i - 1]!)));
    }
    if (ids.length > 0) lastRequiredDone = classDone(ids[ids.length - 1]!);
  }
  return map;
}

/** Campus: stages → semesters → classes with per-class progress + unlock/graduation. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, blurb: semesters.blurb, color: semesters.color, stage: semesters.stage, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, emoji: classes.emoji, blurb: classes.blurb, semesterId: classes.semesterId, sortOrder: classes.sortOrder, examId: classes.examId }).from(classes),
    db.select({ id: lessons.id, classId: lessons.classId }).from(lessons),
  ]);
  const mastery: Record<string, number> = {};
  let examsPassed: string[] = [];
  if (user) {
    for (const r of await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id))) mastery[r.lessonId] = r.mastery;
    const prow = (await db.select({ data: progress.data }).from(progress).where(eq(progress.userId, user.id)).limit(1))[0];
    try {
      examsPassed = (prow?.data ? (JSON.parse(prow.data).schoolExamsPassed as string[]) : []) ?? [];
    } catch {
      examsPassed = [];
    }
  }
  const counts: Record<string, { done: number; total: number }> = {};
  for (const l of les) {
    const c = (counts[l.classId] ??= { done: 0, total: 0 });
    c.total++;
    if ((mastery[l.id] ?? 0) >= 0.9) c.done++;
  }
  const semById = new Map(sems.map((s) => [s.id, s]));
  const classDone = (id: string) => {
    const c = counts[id];
    return !!c && c.total > 0 && c.done >= c.total;
  };

  const ordered = orderClasses(
    sems.map((s) => ({ id: s.id, stage: s.stage, sortOrder: s.sortOrder, title: s.title })),
    cls.map((c) => ({ id: c.id, semesterId: c.semesterId, sortOrder: c.sortOrder, title: c.title })),
  );
  const unlockedOf = computeUnlocked(ordered, semById, classDone);

  const stages = STAGE_ORDER.map((stageId) => {
    const meta = STAGE_META[stageId]!;
    const stageSems = sems
      .filter((s) => s.stage === stageId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => {
        const semClasses = cls
          .filter((c) => c.semesterId === s.id)
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((c) => ({
            id: c.id,
            title: c.title,
            emoji: c.emoji,
            blurb: c.blurb,
            done: counts[c.id]?.done ?? 0,
            total: counts[c.id]?.total ?? 0,
            graduated: classDone(c.id),
            unlocked: unlockedOf.get(c.id) ?? false,
            examId: c.examId ?? null,
          }));
        return { id: s.id, title: s.title, color: s.color, blurb: s.blurb, classes: semClasses };
      })
      .filter((s) => s.classes.length > 0);
    const allClasses = stageSems.flatMap((s) => s.classes);
    const doneClasses = allClasses.filter((c) => c.graduated).length;
    return { id: stageId, ...meta, semesters: stageSems, doneClasses, totalClasses: allClasses.length };
  }).filter((s) => s.totalClasses > 0);

  type StageRow = (typeof stages)[number] & { locked: boolean; cleared: boolean };
  const out: StageRow[] = stages.map((s) => ({
    ...s,
    cleared: s.doneClasses >= s.totalClasses || examsPassed.includes(s.id),
    locked: false,
  }));
  for (let idx = 0; idx < out.length; idx++) {
    const priorOk = out.slice(0, idx).every((p) => p.cleared || p.optional);
    out[idx]!.locked = !priorOk;
  }

  return NextResponse.json({ stages: out });
}
