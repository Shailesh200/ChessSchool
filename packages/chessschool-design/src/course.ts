/** The course the API stores and both apps render. Steps are the lesson player script. */
export type CourseLesson = {
  id: string;
  unit: string;
  title: string;
  sub: string;
  minutes: number;
  xp: number;
  steps?: unknown[];
  /** True when GET /v1/course says this lesson is closed until the learner enrolls. Absent on older payloads. */
  guestLocked?: boolean;
};

export type CourseUnit = { id: string; title: string; sub: string };
export type ComingSoonItem = { id: string; title: string; sub: string };
export type Course = { units: CourseUnit[]; lessons: CourseLesson[]; comingSoon?: ComingSoonItem[] };

export const COURSE_KEY = "chessschool.v2.course";

export function parseCourse(raw: string | null): Course | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Course;
    if (!v || !Array.isArray(v.units) || !Array.isArray(v.lessons)) return null;
    return { units: v.units, lessons: v.lessons.map(normalizeGuestLock) };
  } catch {
    return null;
  }
}

export type FocusCourse = {
  doneCount: number;
  unitCount: number;
  unitsDone: CourseUnit[];
  justFinished: CourseLesson | null;
  current: CourseLesson | null;
  currentUnit: CourseUnit | null;
  upcoming: CourseLesson[];
  rest: CourseLesson[];
  done: CourseLesson[];
};

/** The focused path: last finished lesson, the one to play, two coming up, and the rest counted. */
export function focusCourse(course: Course, completed: Record<string, string | undefined>): FocusCourse {
  const done = course.lessons.filter((l) => completed[l.id]);
  const open = course.lessons.filter((l) => !completed[l.id]);
  const current = open[0] ?? null;
  const unitsDone = course.units.filter((u) => {
    const mine = course.lessons.filter((l) => l.unit === u.id);
    return mine.length > 0 && mine.every((l) => completed[l.id]);
  });
  return {
    doneCount: done.length,
    unitCount: course.units.length,
    unitsDone,
    justFinished: done.at(-1) ?? null,
    current,
    currentUnit: current ? (course.units.find((u) => u.id === current.unit) ?? null) : null,
    upcoming: open.slice(1, 3),
    rest: open.slice(3),
    done,
  };
}

/** The lesson after `id` in course order, or null at the end. */
export function lessonAfter(course: Course, id: string): CourseLesson | null {
  const i = course.lessons.findIndex((l) => l.id === id);
  return i < 0 ? null : (course.lessons[i + 1] ?? null);
}

/** A unit opens once every lesson in each earlier unit is finished. The first unit is always open. */
export function unitUnlocked(course: Course, completed: Record<string, string | undefined>, unitId: string): boolean {
  const index = course.units.findIndex((u) => u.id === unitId);
  if (index < 0) return false;
  for (let i = 0; i < index; i++) {
    const mine = course.lessons.filter((l) => l.unit === course.units[i].id);
    if (mine.length === 0 || mine.some((l) => !completed[l.id])) return false;
  }
  return true;
}

export type LessonAccess = "done" | "current" | "locked";

/** Done lessons can be replayed. The first unfinished lesson in an open unit is current. The rest stay locked. */
export function lessonAccess(course: Course, completed: Record<string, string | undefined>, id: string): LessonAccess {
  if (completed[id]) return "done";
  const lesson = course.lessons.find((l) => l.id === id);
  if (!lesson || !unitUnlocked(course, completed, lesson.unit)) return "locked";
  const current = course.lessons.find((l) => !completed[l.id] && unitUnlocked(course, completed, l.unit));
  return current?.id === id ? "current" : "locked";
}

/**
 * The next lesson that is not already finished.
 * With `afterId`, only looks forward, and treats that lesson as done so the next class can unlock.
 */
export function nextOpenLesson(course: Course, completed: Record<string, string | undefined>, afterId?: string): CourseLesson | null {
  const marked = afterId ? { ...completed, [afterId]: completed[afterId] ?? "done" } : completed;
  const start = afterId ? course.lessons.findIndex((l) => l.id === afterId) + 1 : 0;
  const from = start < 0 ? 0 : start;
  return course.lessons.slice(from).find((l) => l.id !== afterId && !completed[l.id] && unitUnlocked(course, marked, l.unit)) ?? null;
}

/** True only when the course payload set `guestLocked`. Missing or non-boolean means open. */
export function isGuestLockedLesson(lesson: { guestLocked?: unknown } | null | undefined): boolean {
  return lesson?.guestLocked === true;
}

function normalizeGuestLock(lesson: CourseLesson): CourseLesson {
  const flag = (lesson as { guestLocked?: unknown }).guestLocked;
  if (flag === true || flag === false) return { ...lesson, guestLocked: flag };
  if (!("guestLocked" in lesson)) return lesson;
  const { guestLocked: _ignored, ...rest } = lesson;
  return rest;
}
