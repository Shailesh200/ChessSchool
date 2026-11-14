"use client";

import { courseKey, isGuestClassLimit, language, parseCourse, type Course, type CourseLesson } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { api } from "./api";
import { useApp } from "./state";

const lessonKey = (id: string) => `${courseKey()}.lesson.${id}`;

function readLesson(id: string): CourseLesson | null {
  try {
    const v = JSON.parse(localStorage.getItem(lessonKey(id)) ?? "null") as CourseLesson | null;
    return v && Array.isArray(v.steps) ? v : null;
  } catch {
    return null;
  }
}

const RETRY_MS = [1000, 2000, 4000];

/** The language whose course is loaded (false: none yet). */
let loaded: string | false = false;
let flight: Promise<Course> | null = null;
let flightLang = "";
let retryTimer: ReturnType<typeof setTimeout> | undefined;
let retries = 0;
const subscribers = new Set<(course: Course) => void>();

function publish(next: Course, lang: string) {
  // A response for a language the app has since left is dropped.
  if (lang !== language()) return;
  loaded = lang;
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = undefined;
  retries = 0;
  try {
    localStorage.setItem(courseKey(), JSON.stringify(next));
  } catch {
    /* the in-memory course is enough to leave the loading state */
  }
  for (const notify of subscribers) notify(next);
}

function requestCourse(): Promise<Course> {
  if (flight && flightLang === language()) return flight;
  const lang = language();
  flightLang = lang;
  const run = api
    .course()
    .then((next) => {
      publish(next, lang);
      return next;
    })
    .finally(() => {
      if (flight === run) flight = null;
    });
  flight = run;
  return run;
}

function scheduleRetry() {
  if (loaded === language() || flight || retryTimer || retries >= RETRY_MS.length) return;
  const wait = RETRY_MS[retries];
  retries += 1;
  retryTimer = setTimeout(() => {
    retryTimer = undefined;
    if (loaded === language()) return;
    requestCourse().catch(() => scheduleRetry());
  }, wait);
}

function kickCourse() {
  if (loaded === language() || (flight && flightLang === language()) || retryTimer) return;
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
    const cached = parseCourse(localStorage.getItem(courseKey()));
    if (cached) {
      loaded = language();
      setCourse(cached);
    }
    const notify = (next: Course) => setCourse(next);
    subscribers.add(notify);
    const onFocus = () => {
      if (loaded !== language()) kickCourse();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible" && loaded !== language()) kickCourse();
    };
    const userChanged = sawUser.current !== undefined && sawUser.current !== userId;
    sawUser.current = userId;
    if (loaded !== language() || userChanged) kickCourse();
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

