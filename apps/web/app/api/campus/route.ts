import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons, lessonRecords } from "@/db/schema";
import { getApiUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

const STAGE_META: Record<string, { name: string; emoji: string; blurb: string }> = {
  elementary: { name: "Elementary School", emoji: "🎒", blurb: "The essentials" },
  middle: { name: "Middle School", emoji: "📐", blurb: "Tactics & endgames" },
  high: { name: "High School", emoji: "🎓", blurb: "Openings & checkmates" },
  university: { name: "University", emoji: "🏛️", blurb: "Advanced combinations" },
  master: { name: "Master Program", emoji: "♛", blurb: "Famous mates & immortals" },
};
const STAGE_ORDER = ["elementary", "middle", "high", "university", "master"];

/** The campus: stages → classes with per-class progress + sequential lock. */
export async function GET(req: Request) {
  const user = await getApiUser(req);
  const [sems, cls, les] = await Promise.all([
    db.select({ id: semesters.id, stage: semesters.stage, sortOrder: semesters.sortOrder }).from(semesters),
    db.select({ id: classes.id, title: classes.title, emoji: classes.emoji, blurb: classes.blurb, semesterId: classes.semesterId, sortOrder: classes.sortOrder }).from(classes),
    db.select({ id: lessons.id, classId: lessons.classId }).from(lessons),
  ]);
  const mastery: Record<string, number> = {};
  if (user) {
    for (const r of await db.select().from(lessonRecords).where(eq(lessonRecords.userId, user.id))) mastery[r.lessonId] = r.mastery;
  }
  const counts: Record<string, { done: number; total: number }> = {};
  for (const l of les) {
    const c = (counts[l.classId] ??= { done: 0, total: 0 });
    c.total++;
    if ((mastery[l.id] ?? 0) >= 0.9) c.done++;
  }
  const semStage = new Map(sems.map((s) => [s.id, s.stage]));
  const semOrder = new Map(sems.map((s) => [s.id, s.sortOrder]));

  const stages = STAGE_ORDER.map((stageId) => {
    const meta = STAGE_META[stageId]!;
    const stageClasses = cls
      .filter((c) => semStage.get(c.semesterId) === stageId)
      .sort((a, b) => (semOrder.get(a.semesterId) ?? 0) - (semOrder.get(b.semesterId) ?? 0) || a.sortOrder - b.sortOrder)
      .map((c) => ({ id: c.id, title: c.title, emoji: c.emoji, blurb: c.blurb, done: counts[c.id]?.done ?? 0, total: counts[c.id]?.total ?? 0 }));
    const doneClasses = stageClasses.filter((c) => c.total > 0 && c.done >= c.total).length;
    return { id: stageId, ...meta, classes: stageClasses, doneClasses, totalClasses: stageClasses.length };
  }).filter((s) => s.totalClasses > 0);

  // Sequential lock: a stage unlocks once the previous one is fully complete.
  let prevComplete = true;
  for (const s of stages) {
    (s as typeof s & { locked: boolean }).locked = !prevComplete;
    prevComplete = s.doneClasses >= s.totalClasses;
  }

  return NextResponse.json({ stages });
}
