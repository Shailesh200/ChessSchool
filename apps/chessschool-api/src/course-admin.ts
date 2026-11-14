import { asc, desc, eq, sql } from "drizzle-orm";
import { applyCourse, loadLessonsWithSteps, loadOutline } from "./course";
import { checkCourse, type CourseCheck, type CourseDoc, type CourseLessonDoc } from "./course-check";
import type { Db } from "./db";
import { courseDrafts, courseUnits, courseVersions } from "./schema";

/** The live course as one document (the same shape as data/course.json). Null before a course is seeded. */
export async function loadCourseDoc(db: Db): Promise<CourseDoc | null> {
  const [outline, lessons, units] = await Promise.all([
    loadOutline(db),
    loadLessonsWithSteps(db),
    db.select({ id: courseUnits.id, title: courseUnits.title, sub: courseUnits.sub }).from(courseUnits).orderBy(asc(courseUnits.position)),
  ]);
  if (!outline) return null;
  return {
    version: outline.version,
    units,
    lessons: lessons.map(({ id, unit, title, sub, minutes, xp, steps }) => ({ id, unit, title, sub, minutes, xp, steps })),
    comingSoon: outline.comingSoon,
  };
}

/**
 * The course with one lesson replaced (by id, same place), checked like the seed script: the whole
 * course's shape and order, and a play-through of the edited lesson (the others are already live).
 */
export function checkLessonEdit(doc: CourseDoc, lesson: unknown): CourseCheck {
  const id = (lesson as { id?: unknown } | null)?.id;
  if (!lesson || typeof lesson !== "object" || typeof id !== "string") return { ok: false, errors: ["lesson must be an object with an id"] };
  if (!doc.lessons.some((l) => l.id === id)) return { ok: false, errors: [`lesson ${id}: not in the course (the editor changes existing lessons)`] };
  const next = { ...doc, lessons: doc.lessons.map((l) => (l.id === id ? (lesson as CourseLessonDoc) : l)) };
  return checkCourse(next, (lessonId) => lessonId === id);
}

const stamp = (at: number) => new Date(at).toISOString().slice(0, 19).replace(/[-:T]/g, "");

async function snapshot(db: Db, doc: CourseDoc, note: string, by: string, at: number, id: string) {
  await db.insert(courseVersions).values({ id, version: doc.version, data: JSON.stringify(doc), note, createdBy: by, createdAt: at });
}

/**
 * Makes `doc` live under a new version string and logs a full snapshot (who, when, why).
 * The first publish also logs the course as it was, so it can be rolled back to.
 */
export async function publishCourse(db: Db, current: CourseDoc, doc: CourseDoc, note: string, by: string, at: number, newId: () => string): Promise<string> {
  const count = (await db.select({ id: courseVersions.id }).from(courseVersions)).length;
  if (count === 0) await snapshot(db, current, "before first edit", by, at - 1, newId());
  const version = `edit-${count + 1}-${stamp(at)}`;
  const live = { ...doc, version };
  await applyCourse(db, live);
  await snapshot(db, live, note, by, at, newId());
  return version;
}

export async function listVersions(db: Db) {
  return db
    .select({ id: courseVersions.id, version: courseVersions.version, note: courseVersions.note, createdBy: courseVersions.createdBy, createdAt: courseVersions.createdAt })
    .from(courseVersions)
    .orderBy(desc(courseVersions.createdAt), sql`rowid desc`)
    .limit(100);
}

export async function loadVersion(db: Db, id: string): Promise<CourseDoc | null> {
  const [row] = await db.select({ data: courseVersions.data }).from(courseVersions).where(eq(courseVersions.id, id)).limit(1);
  return row ? (JSON.parse(row.data) as CourseDoc) : null;
}

export async function loadDrafts(db: Db): Promise<Map<string, { lesson: CourseLessonDoc; updatedBy: string; updatedAt: number }>> {
  const rows = await db.select().from(courseDrafts);
  return new Map(rows.map((r) => [r.lessonId, { lesson: JSON.parse(r.data) as CourseLessonDoc, updatedBy: r.updatedBy, updatedAt: r.updatedAt }]));
}

export async function saveDraft(db: Db, lessonId: string, lesson: unknown, by: string, at: number) {
  const data = JSON.stringify(lesson);
  await db
    .insert(courseDrafts)
    .values({ lessonId, data, updatedBy: by, updatedAt: at })
    .onConflictDoUpdate({ target: courseDrafts.lessonId, set: { data, updatedBy: by, updatedAt: at } });
}

export const deleteDraft = (db: Db, lessonId: string) => db.delete(courseDrafts).where(eq(courseDrafts.lessonId, lessonId));
