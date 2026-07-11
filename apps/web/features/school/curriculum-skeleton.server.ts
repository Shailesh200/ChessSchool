import "server-only";
import { unstable_cache } from "next/cache";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { semesters, classes, lessons } from "@/db/schema";

/** Next.js cache tag — invalidated when admin edits curriculum. */
export const CURRICULUM_CACHE_TAG = "curriculum";

export type CurriculumSemesterRow = {
  id: string;
  title: string;
  blurb: string;
  color: string;
  stage: string;
  sortOrder: number;
};

export type CurriculumClassRow = {
  id: string;
  title: string;
  emoji: string;
  blurb: string;
  semesterId: string;
  difficulty: number;
  examId: string | null;
  sortOrder: number;
};

export type CurriculumLessonRow = {
  id: string;
  classId: string;
  title: string;
  emoji: string;
  tag: string;
  isExam: number;
  sortOrder: number;
};

export type CurriculumSkeleton = {
  semesters: CurriculumSemesterRow[];
  classes: CurriculumClassRow[];
  lessons: CurriculumLessonRow[];
};

/** Uncached DB read — metadata only (no lesson `steps` blobs). */
export async function loadCurriculumSkeleton(): Promise<CurriculumSkeleton> {
  const [sems, cls, les] = await Promise.all([
    db
      .select({
        id: semesters.id,
        title: semesters.title,
        blurb: semesters.blurb,
        color: semesters.color,
        stage: semesters.stage,
        sortOrder: semesters.sortOrder,
      })
      .from(semesters)
      .orderBy(asc(semesters.sortOrder)),
    db
      .select({
        id: classes.id,
        title: classes.title,
        emoji: classes.emoji,
        blurb: classes.blurb,
        semesterId: classes.semesterId,
        difficulty: classes.difficulty,
        examId: classes.examId,
        sortOrder: classes.sortOrder,
      })
      .from(classes)
      .orderBy(asc(classes.sortOrder)),
    db
      .select({
        id: lessons.id,
        classId: lessons.classId,
        title: lessons.title,
        emoji: lessons.emoji,
        tag: lessons.tag,
        isExam: lessons.isExam,
        sortOrder: lessons.sortOrder,
      })
      .from(lessons)
      .orderBy(asc(lessons.sortOrder)),
  ]);
  return { semesters: sems, classes: cls, lessons: les };
}

const getCachedSkeleton = unstable_cache(
  loadCurriculumSkeleton,
  ["curriculum-skeleton-v1"],
  { tags: [CURRICULUM_CACHE_TAG], revalidate: 3600 },
);

/** Cached curriculum skeleton — shared by campus, catalog, library, next-lesson. */
export async function getCurriculumSkeleton(): Promise<CurriculumSkeleton> {
  // Dev re-seeds local.db often; skip the 1h cache so campus matches the DB immediately.
  if (process.env.NODE_ENV === "development") {
    return loadCurriculumSkeleton();
  }
  return getCachedSkeleton();
}
