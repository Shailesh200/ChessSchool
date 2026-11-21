import type { RateInput } from "./api";
import type { DailyMinutes, GameRecord, LocalState } from "./progress";
import { sanitizeGameRecord } from "./games";
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

/**
 * A write waiting for a connection: a board-vision score for the class board, a finished game for the
 * account's game history (`child` says whose), or a solved daily puzzle for the "solved by" count.
 */
export type QueuedWrite =
  | { id: string; kind: "vision"; game: string; score: number; day: string }
  | { id: string; kind: "game"; game: GameRecord; child: string | null }
  | { id: string; kind: "daily"; day: string; puzzle: string };
export const WRITE_QUEUE_MAX = 200;

const DAY = /^\d{4}-\d{2}-\d{2}$/;
function cleanWrite(w: unknown): QueuedWrite | null {
  if (!w || typeof w !== "object") return null;
  const x = w as Record<string, unknown>;
  if (typeof x.id !== "string") return null;
  if (x.kind === "vision") return typeof x.game === "string" && typeof x.score === "number" && typeof x.day === "string" ? (x as QueuedWrite) : null;
  if (x.kind === "game") {
    const game = sanitizeGameRecord(x.game);
    return game ? { id: x.id, kind: "game", game, child: typeof x.child === "string" ? x.child : null } : null;
  }
  if (x.kind === "daily") return typeof x.day === "string" && DAY.test(x.day) && typeof x.puzzle === "string" ? { id: x.id, kind: "daily", day: x.day, puzzle: x.puzzle } : null;
  return null;
}

export function sanitizeWriteQueue(raw: unknown): QueuedWrite[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(cleanWrite).filter((w): w is QueuedWrite => w !== null).slice(-WRITE_QUEUE_MAX);
}

/** Queues a board-vision score. A better score for the same game and day replaces the waiting one (the server keeps the best anyway). */
export function queueVisionScore(s: LocalState, game: string, score: number, day: string): LocalState {
  const id = `vision:${game}:${day}`;
  const waiting = s.writeQueue.find((w) => w.id === id);
  if (waiting && waiting.kind === "vision" && waiting.score >= score) return s;
  return { ...s, writeQueue: [...s.writeQueue.filter((w) => w.id !== id), { id, kind: "vision" as const, game, score, day }].slice(-WRITE_QUEUE_MAX) };
}

/** Queues a finished game for the account's history (saving it twice is harmless: the server keys it by id). */
export function queueGameSave(s: LocalState, game: GameRecord): LocalState {
  const id = `game:${s.activeChild ?? ""}:${game.id}`;
  return { ...s, writeQueue: [...s.writeQueue.filter((w) => w.id !== id), { id, kind: "game" as const, game, child: s.activeChild }].slice(-WRITE_QUEUE_MAX) };
}

/** Queues today's daily-puzzle solve for the shared count (once per learner and day). */
export function queueDailySolve(s: LocalState, day: string, puzzle: string): LocalState {
  const id = `daily:${s.activeChild ?? ""}:${day}`;
  if (s.writeQueue.some((w) => w.id === id)) return s;
  return { ...s, writeQueue: [...s.writeQueue, { id, kind: "daily" as const, day, puzzle }].slice(-WRITE_QUEUE_MAX) };
}

/** One queued write reached the server, or was refused for good. A newer score queued meanwhile stays. */
export const writeSent = (s: LocalState, sent: QueuedWrite): LocalState => ({
  ...s,
  writeQueue: s.writeQueue.filter((w) => !(w.id === sent.id && (w.kind !== "vision" || sent.kind !== "vision" || w.score === sent.score))),
});

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
  saveGame?: (game: GameRecord, child: string | null) => Promise<unknown>;
  dailySolved?: (day: string, puzzle: string, solver: string | null) => Promise<unknown>;
};

/**
 * Sends everything that was queued when it started, oldest first: rated results, then other writes.
 * Stops at the first failure that is not a refusal (offline, server error), leaving the rest in order for
 * the next try. Returns true when it got through. Safe to repeat: the server dedupes rated results by
 * event id, keeps the best vision score, keys saved games by id and counts a daily solve once per learner.
 * Signed out (`signedIn: false`), only daily solves go out (as the device's guest id).
 */
export async function drainQueues(get: () => LocalState, apply: (fn: (s: LocalState) => LocalState) => void, api: DrainApi, opts: { signedIn?: boolean } = {}): Promise<boolean> {
  const signedIn = opts.signedIn !== false;
  if (signedIn) {
    for (const next of [...get().ratingQueue]) {
      try {
        const r = await api.rate(next);
        apply((s) => ratingSent(s, next, r.ratings));
      } catch (err) {
        if (!refused(err)) return false;
        apply((s) => ratingSent(s, next));
      }
    }
  }
  for (const next of [...get().writeQueue]) {
    if (!signedIn && next.kind !== "daily") continue;
    try {
      if (next.kind === "vision") await api.sendVisionScore(next.game, next.score, next.day);
      else if (next.kind === "game") {
        if (!api.saveGame) continue;
        await api.saveGame(next.game, next.child);
      } else {
        if (!api.dailySolved) continue;
        await api.dailySolved(next.day, next.puzzle, signedIn ? null : get().guestId);
      }
    } catch (err) {
      if (!refused(err)) return false;
    }
    apply((s) => writeSent(s, next));
  }
  return true;
}
