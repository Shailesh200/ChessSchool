"use client";

import { COURSE_KEY, isGuestClassLimit, parseCourse, type Course, type CourseLesson } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useApp } from "./state";

const lessonKey = (id: string) => `${COURSE_KEY}.lesson.${id}`;

function readLesson(id: string): CourseLesson | null {
  try {
    const v = JSON.parse(localStorage.getItem(lessonKey(id)) ?? "null") as CourseLesson | null;
    return v && Array.isArray(v.steps) ? v : null;
  } catch {
    return null;
  }
}

const RETRY_MS = [1000, 2000, 4000];

let loaded = false;
let flight: Promise<Course> | null = null;
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retries = 0;
const subscribers = new Set<(course: Course) => void>();

function publish(next: Course) {
  loaded = true;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  retries = 0;
  try {
    localStorage.setItem(COURSE_KEY, JSON.stringify(next));
  } catch {
    /* the in-memory course is enough to leave the loading state */
  }
  for (const notify of subscribers) notify(next);
}

function requestCourse(): Promise<Course> {
  if (flight) return flight;
  const run = api
    .course()
    .then((next) => {
      publish(next);
      return next;
    })
    .finally(() => {
      if (flight === run) flight = null;
    });
  flight = run;
  return run;
}

function scheduleRetry() {
  if (loaded || flight || retryTimer || retries >= RETRY_MS.length) return;
  const wait = RETRY_MS[retries];
  retries += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (loaded) return;
    requestCourse().catch(() => scheduleRetry());
  }, wait);
}

function kickCourse() {
  if (loaded || flight || retryTimer) return;
  retries = 0;
  requestCourse().catch(() => scheduleRetry());
}

/** Cached course outline, refreshed from the API. Steps are not in this payload. */
export function useCourse() {
  const { state } = useApp();
  const userId = state.account?.id ?? null;
  const [course, setCourse] = useState<Course | null>(null);
  const sawUser = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const cached = parseCourse(localStorage.getItem(COURSE_KEY));
    if (cached) {
      loaded = true;
      setCourse(cached);
    }
    const notify = (next: Course) => setCourse(next);
    subscribers.add(notify);
    const onFocus = () => {
      if (!loaded) kickCourse();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && !loaded) kickCourse();
    };
    const userChanged = sawUser.current !== undefined && sawUser.current !== userId;
    sawUser.current = userId;
    if (!loaded || userChanged) kickCourse();
    else requestCourse().catch(() => {});
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      subscribers.delete(notify);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
      if (subscribers.size === 0 && retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = undefined;
      }
    };
  }, [userId]);

  return course;
}

/** One lesson's steps, loaded when the lesson opens. A guest-limit refusal opens the enroll sheet. */
export function useLesson(id: string | undefined) {
  const { showGuestGate } = useApp();
  const [lesson, setLesson] = useState<CourseLesson | null>(null);
  const [limitedId, setLimitedId] = useState<string | null>(null);
  useEffect(() => {
    if (!id || id === "meet") return;
    const cached = readLesson(id);
    if (cached) setLesson(cached);
    let live = true;
    api
      .lesson(id)
      .then((l) => {
        if (!live) return;
        localStorage.setItem(lessonKey(id), JSON.stringify(l));
        setLesson(l);
      })
      .catch((err) => {
        if (!live) return;
        if (isGuestClassLimit(err)) {
          setLimitedId(id);
          showGuestGate();
        }
      });
    return () => {
      live = false;
    };
  }, [id, showGuestGate]);
  return { lesson, guestLimited: limitedId === id };
}

/** Steps for the lessons practice needs, fetched only when that session starts. */
export function useLessonScripts(ids: string[] | null) {
  const { showGuestGate } = useApp();
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
      .catch((err) => {
        if (!live) return;
        if (isGuestClassLimit(err)) showGuestGate();
        setSteps([]);
      });
    return () => {
      live = false;
    };
  }, [key, showGuestGate]);
  return ids ? steps : null;
}
