import type { LocalState } from "./progress";

/**
 * First run: a new install goes straight into the first lesson, then a short welcome (coach and
 * language), then the account offer. Returning learners and signed-in accounts never see welcome again.
 */
export type AuthKind = "login" | "signup" | "google" | "apple";

/** The first real lesson ("meet" is the tour). Used before the course has loaded. */
export const FIRST_LESSON = "board";

export const firstLessonId = (course?: { lessons: readonly { id: string }[] } | null): string => course?.lessons.find((l) => l.id !== "meet")?.id ?? FIRST_LESSON;

/** Path to the first lesson in first-run mode (no locks, then on to welcome). */
export const firstLessonHref = (course?: { lessons: readonly { id: string }[] } | null) => `/lesson/${firstLessonId(course)}?first=1`;

/**
 * Where a sign-in lands. A log in, a device that already did the welcome, or an Apple or Google
 * account that already has progress is a returning learner: Today. A brand-new account: welcome.
 */
export function afterAuthRoute(kind: AuthKind, firstRun: boolean, xp: number): "/today" | "/welcome" {
  const returning = kind === "login" || !firstRun || (kind !== "signup" && xp > 0);
  return returning ? "/today" : "/welcome";
}

/**
 * Where the app opens: the terms (once per device, everyone), then Today for anyone who has been here,
 * else the first lesson, else (lesson done) welcome.
 */
export function startRoute(s: Pick<LocalState, "account" | "seenWelcome" | "progress" | "termsAt">, course?: { lessons: readonly { id: string }[] } | null): string {
  if (!s.termsAt) return "/start";
  if (s.account || s.seenWelcome) return "/today";
  return Object.keys(s.progress.completed).some((id) => id !== "meet") ? "/welcome" : firstLessonHref(course);
}
