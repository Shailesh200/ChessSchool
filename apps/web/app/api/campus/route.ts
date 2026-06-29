import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons, lessonRecords, progress } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGE_META: Record<string, { name: string; emoji: string; blurb: string }> = {
  elementary: { name: "Elementary School", emoji: "🎒", blurb: "Classes · the essentials" },
  middle: { name: "Middle School", emoji: "📐", blurb: "Classes · tactics & endgames" },
  high: { name: "High School", emoji: "🎓", blurb: "Classes · openings & checkmates" },
  university: { name: "University", emoji: "🏛️", blurb: "Classes · advanced combinations" },
  master: { name: "Master Program", emoji: "♛", blurb: "Classes · famous mates & immortals" },
};
const STAGE_ORDER = ["elementary", "middle", "high", "university", "master"];

/** Campus: stages → semesters → classes with per-class progress + unlock/graduation. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, title: semesters.title, blurb: semesters.blurb, color: semesters.color, stage: semesters.stage, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, emoji: classes.emoji, blurb: classes.blurb, semesterId: classes.semesterId, sortOrder: classes.sortOrder }).from(classes),
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

  // Global class order (stage → semester sortOrder → class sortOrder) for sequential unlock.
  const stageRank = (semId: string) => STAGE_ORDER.indexOf(semById.get(semId)?.stage ?? "");
  const ordered = [...cls].sort(
    (a, b) =>
      stageRank(a.semesterId) - stageRank(b.semesterId) ||
      (semById.get(a.semesterId)?.sortOrder ?? 0) - (semById.get(b.semesterId)?.sortOrder ?? 0) ||
      a.sortOrder - b.sortOrder,
  );
  const unlockedOf = new Map<string, boolean>();
  ordered.forEach((c, i) => unlockedOf.set(c.id, i === 0 || classDone(ordered[i - 1]!.id)));

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
          }));
        return { id: s.id, title: s.title, color: s.color, blurb: s.blurb, classes: semClasses };
      })
      .filter((s) => s.classes.length > 0);
    const allClasses = stageSems.flatMap((s) => s.classes);
    const doneClasses = allClasses.filter((c) => c.graduated).length;
    return { id: stageId, ...meta, semesters: stageSems, doneClasses, totalClasses: allClasses.length };
  }).filter((s) => s.totalClasses > 0);

  let prevCleared = true;
  for (const s of stages) {
    const cleared = s.doneClasses >= s.totalClasses || examsPassed.includes(s.id);
    (s as typeof s & { locked: boolean; cleared: boolean }).locked = !prevCleared;
    (s as typeof s & { locked: boolean; cleared: boolean }).cleared = cleared;
    prevCleared = cleared;
  }

  return NextResponse.json({ stages });
}
