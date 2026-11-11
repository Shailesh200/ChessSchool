import AsyncStorage from "@react-native-async-storage/async-storage";
import { COURSE_KEY, parseCourse, type Course, type CourseLesson } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "./api";

const lessonKey = (id: string) => `${COURSE_KEY}.lesson.${id}`;

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
    AsyncStorage.getItem(COURSE_KEY).then((raw) => {
      if (live) setCourse(parseCourse(raw));
    });
    api
      .course()
      .then((c) => {
        if (!live) return;
        setCourse(c);
        void AsyncStorage.setItem(COURSE_KEY, JSON.stringify(c));
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

/** Steps for the lessons practice needs, fetched only when that session starts. */
export function useLessonScripts(ids: string[] | null) {
  const key = ids === null ? null : ids.join(",");
  const [steps, setSteps] = useState<unknown[] | null>(null);
  useEffect(() => {
    if (key === null || !ids) return;
    if (!ids.length) {
      setSteps([]);
      return;
    }
    let live = true;
    Promise.all(ids.map((id) => api.lesson(id)))
      .then((lessons) => {
        if (live) setSteps(lessons.flatMap((l) => l.steps ?? []));
      })
      .catch(() => {
        if (live) setSteps([]);
      });
    return () => {
      live = false;
    };
  }, [key]);
  return ids ? steps : null;
}
