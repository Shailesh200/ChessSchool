import type { LessonRecord } from "@/core/store/progression.store";
import { getLesson } from "@/features/lessons/curriculum";
import type { Lesson } from "@/features/lessons/types";
import { SEMESTERS, STAGES } from "@/content/school";
import type { SchoolClass, Semester, Stage, ContentUnit } from "@/content/school";

/**
 * Academic hierarchy logic: School → Stage → Semester → Class → Lesson, with
 * class exams that let a student "test out". The DATA lives in the constants
 * layer (`@/content/school`); this module is the logic over it.
 */

export { SEMESTERS, STAGES };
export type { SchoolClass, Semester, Stage, ContentUnit };

export const ALL_CLASSES: SchoolClass[] = SEMESTERS.flatMap((s) => s.classes);

/** Semesters belonging to a given stage. */
export function semestersForStage(stageId: string): Semester[] {
  return SEMESTERS.filter((s) => s.stage === stageId);
}

export function getClass(id: string): SchoolClass | undefined {
  return ALL_CLASSES.find((c) => c.id === id);
}

export function classByExamId(examId: string): SchoolClass | undefined {
  return ALL_CLASSES.find((c) => c.examId === examId);
}

export function classLessons(cls: SchoolClass): Lesson[] {
  return cls.lessonIds
    .map((id) => getLesson(id))
    .filter((l): l is Lesson => Boolean(l));
}

const MASTERY = 0.5;
const MASTERED = 0.9;

export function classProgress(
  cls: SchoolClass,
  records: Record<string, LessonRecord>,
): { done: number; total: number; pct: number } {
  const total = cls.lessonIds.length;
  const done = cls.lessonIds.filter((id) => (records[id]?.mastery ?? 0) >= MASTERED).length;
  return { done, total, pct: total === 0 ? 0 : done / total };
}

export function isClassGraduated(
  cls: SchoolClass,
  records: Record<string, LessonRecord>,
  graduatedClasses: string[],
): boolean {
  if (graduatedClasses.includes(cls.id)) return true;
  return cls.lessonIds.every((id) => (records[id]?.mastery ?? 0) >= MASTERED);
}

/** A class is unlocked if it's first, or the previous class is graduated. */
export function isClassUnlocked(
  classId: string,
  records: Record<string, LessonRecord>,
  graduatedClasses: string[],
): boolean {
  const idx = ALL_CLASSES.findIndex((c) => c.id === classId);
  if (idx <= 0) return true;
  const prev = ALL_CLASSES[idx - 1]!;
  return isClassGraduated(prev, records, graduatedClasses);
}

/** First unlocked, not-yet-mastered lesson within a class (or its exam). */
export function nextLessonInClass(
  cls: SchoolClass,
  records: Record<string, LessonRecord>,
): string | null {
  for (const id of cls.lessonIds) {
    if ((records[id]?.mastery ?? 0) < MASTERY) return id;
  }
  return null;
}

/** The class that owns a lesson (or whose exam it is). */
export function classOfLesson(lessonId: string): SchoolClass | undefined {
  return ALL_CLASSES.find(
    (c) => c.lessonIds.includes(lessonId) || c.examId === lessonId,
  );
}

/** The next lesson to study after finishing `lessonId` — powers "Continue". */
export function nextLessonAfter(lessonId: string): string | null {
  const cls = classOfLesson(lessonId);
  if (!cls) return null;
  const classIdx = ALL_CLASSES.findIndex((c) => c.id === cls.id);
  const nextClassFirst = () => {
    const next = ALL_CLASSES[classIdx + 1];
    return next?.lessonIds[0] ?? null;
  };
  // Exam → move to the next class.
  if (cls.examId === lessonId && !cls.lessonIds.includes(lessonId)) {
    return nextClassFirst();
  }
  const idx = cls.lessonIds.indexOf(lessonId);
  if (idx >= 0 && idx < cls.lessonIds.length - 1) return cls.lessonIds[idx + 1]!;
  // Last lesson of the class → take the exam if there is one, else next class.
  if (cls.examId) return cls.examId;
  return nextClassFirst();
}

export interface SchoolLocation {
  semester: Semester;
  cls: SchoolClass;
  lessonId: string;
  lessonTitle: string;
  classIndex: number; // 1-based across all classes
  totalClasses: number;
  complete: boolean; // whole school finished
}

/** Where the student currently stands — powers the breadcrumb / resume card. */
export function currentLocation(
  records: Record<string, LessonRecord>,
  graduatedClasses: string[],
): SchoolLocation {
  for (const semester of SEMESTERS) {
    for (const cls of semester.classes) {
      if (!isClassGraduated(cls, records, graduatedClasses)) {
        const lessonId = nextLessonInClass(cls, records) ?? cls.lessonIds[0]!;
        const lesson = getLesson(lessonId);
        return {
          semester,
          cls,
          lessonId,
          lessonTitle: lesson?.title ?? "Lesson",
          classIndex: ALL_CLASSES.findIndex((c) => c.id === cls.id) + 1,
          totalClasses: ALL_CLASSES.length,
          complete: false,
        };
      }
    }
  }
  // everything graduated — point at the final class for review
  const last = SEMESTERS[SEMESTERS.length - 1]!;
  const cls = last.classes[last.classes.length - 1]!;
  const lessonId = cls.lessonIds[0]!;
  return {
    semester: last,
    cls,
    lessonId,
    lessonTitle: getLesson(lessonId)?.title ?? "Lesson",
    classIndex: ALL_CLASSES.length,
    totalClasses: ALL_CLASSES.length,
    complete: true,
  };
}
