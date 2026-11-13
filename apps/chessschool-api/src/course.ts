import type { Step } from "@chessschool/chess";
import { asc, eq } from "drizzle-orm";
import type { CourseDoc } from "./course-check";
import type { Db } from "./db";
import { course, courseLessons, courseUnits } from "./schema";

/** The course lives in the database: cs_course_units, cs_course_lessons and cs_course("meta"). */

export type PathEntry = { id: string; unit: string; minutes: number; xp: number };
export type LessonOutline = PathEntry & { title: string; sub: string };
export type CourseOutline = {
  version: string;
  units: { id: string; title: string; sub: string }[];
  lessons: LessonOutline[];
  comingSoon: { id: string; title: string; sub: string }[];
};

/** Not "live": that row held the old code-built course, which older API deploys still read. */
const META_ID = "meta";
const outlineColumns = {
  id: courseLessons.id,
  unit: courseLessons.unitId,
  title: courseLessons.title,
  sub: courseLessons.sub,
  minutes: courseLessons.minutes,
  xp: courseLessons.xp,
};

/** Lesson order with the sizes progress checks need. Empty until a course is seeded. */
export async function loadPath(db: Db): Promise<PathEntry[]> {
  return db
    .select({ id: courseLessons.id, unit: courseLessons.unitId, minutes: courseLessons.minutes, xp: courseLessons.xp })
    .from(courseLessons)
    .orderBy(asc(courseLessons.position));
}

export async function loadOutline(db: Db): Promise<CourseOutline | null> {
  const [units, lessons, meta] = await Promise.all([
    db.select({ id: courseUnits.id, title: courseUnits.title, sub: courseUnits.sub }).from(courseUnits).orderBy(asc(courseUnits.position)),
    db.select(outlineColumns).from(courseLessons).orderBy(asc(courseLessons.position)),
    db.query.course.findFirst({ where: eq(course.id, META_ID) }),
  ]);
  if (!lessons.length) return null;
  const info = meta ? (JSON.parse(meta.data) as { version?: string; comingSoon?: CourseOutline["comingSoon"] }) : {};
  return { version: info.version ?? "", units, lessons, comingSoon: info.comingSoon ?? [] };
}

/** Every lesson with its steps, in order. */
export async function loadLessonsWithSteps(db: Db): Promise<(LessonOutline & { steps: Step[] })[]> {
  const rows = await db.select({ ...outlineColumns, steps: courseLessons.steps }).from(courseLessons).orderBy(asc(courseLessons.position));
  return rows.map((r) => ({ ...r, steps: JSON.parse(r.steps) as Step[] }));
}

export async function loadLesson(db: Db, id: string): Promise<(LessonOutline & { steps: Step[] }) | null> {
  const [row] = await db.select({ ...outlineColumns, steps: courseLessons.steps }).from(courseLessons).where(eq(courseLessons.id, id)).limit(1);
  return row ? { ...row, steps: JSON.parse(row.steps) as Step[] } : null;
}

export type CourseCounts = { units: number; insert: number; update: number; delete: number; unchanged: number };

/** What applying `doc` would change, by lesson. */
export async function courseDiff(db: Db, doc: CourseDoc): Promise<CourseCounts> {
  const current = new Map((await db.select().from(courseLessons)).map((r) => [r.id, r]));
  const counts: CourseCounts = { units: doc.units.length, insert: 0, update: 0, delete: 0, unchanged: 0 };
  doc.lessons.forEach((l, position) => {
    const row = current.get(l.id);
    if (!row) counts.insert++;
    else if (row.unitId !== l.unit || row.position !== position || row.title !== l.title || row.sub !== l.sub || row.minutes !== l.minutes || row.xp !== l.xp || row.steps !== JSON.stringify(l.steps)) counts.update++;
    else counts.unchanged++;
    current.delete(l.id);
  });
  counts.delete = current.size;
  return counts;
}

/** Replaces the whole course in one batch, so readers see the old course or the new one, never a mix. */
export async function applyCourse(db: Db, doc: CourseDoc): Promise<CourseCounts> {
  const counts = await courseDiff(db, doc);
  await db.batch([
    db.delete(courseLessons),
    db.delete(courseUnits),
    db.insert(courseUnits).values(doc.units.map((u, position) => ({ id: u.id, position, title: u.title, sub: u.sub }))),
    db.insert(courseLessons).values(
      doc.lessons.map((l, position) => ({ id: l.id, unitId: l.unit, position, title: l.title, sub: l.sub, minutes: l.minutes, xp: l.xp, steps: JSON.stringify(l.steps) })),
    ),
    db
      .insert(course)
      .values({ id: META_ID, data: JSON.stringify({ version: doc.version, comingSoon: doc.comingSoon }) })
      .onConflictDoUpdate({ target: course.id, set: { data: JSON.stringify({ version: doc.version, comingSoon: doc.comingSoon }) } }),
  ]);
  return counts;
}
