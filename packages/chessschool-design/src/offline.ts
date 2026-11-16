import type { RateInput } from "./api";
import type { DailyMinutes, LocalState } from "./progress";
import { ratingSent } from "./rating";
import type { Ratings } from "./rating";

/**
 * Works offline: what to keep on the device ahead of time, and the queue of writes made without a
 * connection. Lessons finished offline need no queue (progress is saved on the device and pushed whole when
 * the connection returns). Rated results wait in `ratingQueue`; every other write waits in `writeQueue`.
 * `drainQueues` sends both, oldest first.
 */

/** How many days of lessons and practice to keep ready on the device. */
export const OFFLINE_DAYS = 3;

/**
 * The lessons to keep on the device: enough unfinished ones, in course order, to fill `days` days at the
 * learner's daily goal (at least one lesson a day). Lessons closed to a guest are left out.
 */
export function lessonsForDays(course: { lessons: { id: string; minutes: number; guestLocked?: boolean }[] }, completed: Record<string, string>, dailyMinutes: DailyMinutes, days = OFFLINE_DAYS): string[] {
  const ids: string[] = [];
  let minutes = 0;
  for (const l of course.lessons) {
    if (completed[l.id] || l.id === "meet" || l.guestLocked) continue;
    if (ids.length >= days && minutes >= days * dailyMinutes) break;
    ids.push(l.id);
    minutes += l.minutes;
  }
  return ids;
}

/** A write waiting for a connection. One kind so far: a board-vision score for the class board. */
export type QueuedWrite = { id: string; kind: "vision"; game: string; score: number; day: string };
export const WRITE_QUEUE_MAX = 200;

export function sanitizeWriteQueue(raw: unknown): QueuedWrite[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((w): w is QueuedWrite => Boolean(w && typeof w === "object" && typeof w.id === "string" && w.kind === "vision" && typeof w.game === "string" && typeof w.score === "number" && typeof w.day === "string"))
    .slice(-WRITE_QUEUE_MAX);
}

/** Queues a board-vision score. A better score for the same game and day replaces the waiting one (the server keeps the best anyway). */
export function queueVisionScore(s: LocalState, game: string, score: number, day: string): LocalState {
  const id = `vision:${game}:${day}`;
  const waiting = s.writeQueue.find((w) => w.id === id);
  if (waiting && waiting.score >= score) return s;
  return { ...s, writeQueue: [...s.writeQueue.filter((w) => w.id !== id), { id, kind: "vision" as const, game, score, day }].slice(-WRITE_QUEUE_MAX) };
}

/** One queued write reached the server, or was refused for good. A newer score queued meanwhile stays. */
export const writeSent = (s: LocalState, sent: QueuedWrite): LocalState => ({ ...s, writeQueue: s.writeQueue.filter((w) => !(w.id === sent.id && w.score === sent.score)) });

/** True when a call failed because the server could not be reached (as opposed to refusing the request). */
export const isOfflineError = (err: unknown) => Number((err as { status?: unknown } | null)?.status ?? 0) === 0;

/** A request the server will never accept (bad input, unknown child): drop it instead of blocking the queue. */
const refused = (err: unknown) => {
  const status = Number((err as { status?: unknown } | null)?.status);
  return status === 400 || status === 404;
};

type DrainApi = {
  rate: (input: RateInput) => Promise<{ ratings: Ratings }>;
  sendVisionScore: (game: string, score: number, day: string) => Promise<unknown>;
};

/**
 * Sends everything that was queued when it started, oldest first: rated results, then other writes.
 * Stops at the first failure that is not a refusal (offline, server error), leaving the rest in order for
 * the next try. Returns true when it got through. Safe to repeat: the server dedupes rated results by
 * event id and keeps the best vision score.
 */
export async function drainQueues(get: () => LocalState, apply: (fn: (s: LocalState) => LocalState) => void, api: DrainApi): Promise<boolean> {
  for (const next of [...get().ratingQueue]) {
    try {
      const r = await api.rate(next);
      apply((s) => ratingSent(s, next, r.ratings));
    } catch (err) {
      if (!refused(err)) return false;
      apply((s) => ratingSent(s, next));
    }
  }
  for (const next of [...get().writeQueue]) {
    try {
      await api.sendVisionScore(next.game, next.score, next.day);
    } catch (err) {
      if (!refused(err)) return false;
    }
    apply((s) => writeSent(s, next));
  }
  return true;
}
