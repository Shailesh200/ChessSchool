/** The course the API stores and both apps render. Steps are the lesson player script. */
export type CourseLesson = {
  id: string;
  unit: string;
  title: string;
  sub: string;
  minutes: number;
  xp: number;
  steps?: unknown[];
};

export type CourseUnit = { id: string; title: string; sub: string };
export type Course = { units: CourseUnit[]; lessons: CourseLesson[] };

export const COURSE_KEY = "chessschool.v2.course";

export function parseCourse(raw: string | null): Course | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw) as Course;
    if (!v || !Array.isArray(v.units) || !Array.isArray(v.lessons)) return null;
    return v;
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
