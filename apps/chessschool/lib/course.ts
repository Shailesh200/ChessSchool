import AsyncStorage from "@react-native-async-storage/async-storage";
import { courseKey, dayKey, lessonsForDays, parseCourse, PRACTICE_KEEP, practiceStockRequest, type Course, type CourseLesson } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "./api";
import { useApp } from "./state";

const lessonKey = (id: string) => `${courseKey()}.lesson.${id}`;

async function readLesson(id: string): Promise<CourseLesson | null> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(lessonKey(id))) ?? "null") as CourseLesson | null;
    return v && Array.isArray(v.steps) ? v : null;
  } catch {
    return null;
  }
}

/** Cached course outline, refreshed from the API. Steps are not in this payload. */
export function useCourse() {
  const [course, setCourse] = useState<Course | null>(null);
  useEffect(() => {
    let live = true;
    AsyncStorage.getItem(courseKey()).then((raw) => {
      if (live) setCourse(parseCourse(raw));
    });
    api
      .course()
      .then((c) => {
        if (!live) return;
        setCourse(c);
        void AsyncStorage.setItem(courseKey(), JSON.stringify(c));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);
  return course;
}

/** One lesson's steps, loaded when the lesson opens. */
export function useLesson(id: string | undefined) {
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  useEffect(() => {
    if (!id || id === "meet") return;
    let live = true;
    readLesson(id).then((cached) => {
      if (live && cached) setLesson(cached);
    });
    api
      .lesson(id)
      .then((l) => {
        if (!live) return;
        setLesson(l);
        void AsyncStorage.setItem(lessonKey(id), JSON.stringify(l));
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id]);
  return lesson;
}


/** Saves lessons where useLesson looks first, so they open offline. Returns how many were saved. */
export async function saveLessonsOffline(ids: string[]): Promise<number> {
  let saved = 0;
  for (const id of ids) {
    try {
      await AsyncStorage.setItem(lessonKey(id), JSON.stringify(await api.lesson(id, true)));
      saved++;
    } catch {}
  }
  return saved;
}

/**
 * Keeps the next three days ready on the device: lesson steps and practice positions (puzzles ship in the
 * puzzle pack). Quiet: a failure is tried again on the next launch or after the next lesson.
 */
export function useOfflineStock() {
  const { state, ready, setPracticeNext } = useApp();
  const course = useCourse();
  const done = Object.keys(state.progress.completed).length;
  useEffect(() => {
    if (!ready || !course) return;
    let live = true;
    void (async () => {
      const missing: string[] = [];
      for (const id of lessonsForDays(course, state.progress.completed, state.profile.dailyMinutes)) if (!(await readLesson(id))) missing.push(id);
      if (missing.length) await saveLessonsOffline(missing);
      if (!live || !done || state.practiceNext.length >= PRACTICE_KEEP) return;
      const { items } = await api.practice(practiceStockRequest(state.progress.completed, state.review, dayKey(new Date()), state.progress.skills));
      if (live && items.length > state.practiceNext.length) setPracticeNext(items);
    })().catch(() => {});
    return () => {
      live = false;
    };
    // Runs when the course arrives and after each finished lesson, with the state at that moment.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, course, done, state.account?.id]);
}
