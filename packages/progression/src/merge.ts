import { isCalendarDay } from "./day";

/**
 * A writer stamp is an integer millisecond time.
 * Values below 0 are rejected. A stamp ahead of `now` is clamped to `now`.
 */
export function clampWriterStamp(value: unknown, now = Date.now()): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0) return null;
  return Math.min(value, now);
}

/**
 * Last writer wins by an integer timestamp. A missing or rejected stamp never
 * beats a present one. When both are missing, or they tie, the larger value wins.
 */
export function pickLastWriterNumber(
  localValue: number,
  localAt: unknown,
  serverValue: number,
  serverAt: unknown,
  now = Date.now(),
): { value: number; at: number | null } {
  const localStamp = clampWriterStamp(localAt, now);
  const serverStamp = clampWriterStamp(serverAt, now);
  if (localStamp === null && serverStamp === null) {
    return { value: Math.max(localValue, serverValue), at: null };
  }
  if (localStamp === null) return { value: serverValue, at: serverStamp };
  if (serverStamp === null) return { value: localValue, at: localStamp };
  if (localStamp === serverStamp) {
    return { value: Math.max(localValue, serverValue), at: localStamp };
  }
  return localStamp > serverStamp
    ? { value: localValue, at: localStamp }
    : { value: serverValue, at: serverStamp };
}

/**
 * One side of a last-writer pick. A stamp counts only with its own value: a
 * stamp that arrives without a usable value is dropped, so a missing field can
 * never beat the other side, or reset it to `fallback`, by carrying a stamp.
 */
export function writerSide(
  value: number | undefined,
  stamp: unknown,
  fallback: number,
): { value: number; stamp: unknown } {
  return value === undefined ? { value: fallback, stamp: null } : { value, stamp };
}

export const RATING_MIN = 100;
export const RATING_MAX = 3000;

/** A finite rating pulled into 100..3000. Anything else is no value. */
export function clampRating(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(RATING_MAX, Math.max(RATING_MIN, Math.round(value)));
}

/**
 * The daily goals the app can produce: the plan tiers (30, 50, 80, 130) and
 * the custom slider (10..200 in steps of 10). An older client or a hand edited
 * value outside that set snaps to the nearest allowed goal, so it is not lost.
 * Only a value that is not a finite number is no value.
 */
export function allowedDailyGoal(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  return Math.min(200, Math.max(10, Math.round(value / 10) * 10));
}

export const MAX_ACTIVITY_DAYS = 2000;
export const MAX_WEAKNESSES = 200;

/**
 * Keep the newest `max` keys of a day map. Keys are `YYYY-MM-DD`, so the
 * larger string is the later day. Truncates and never rejects.
 */
export function capActivityDays(
  map: Record<string, number> | undefined,
  max = MAX_ACTIVITY_DAYS,
): Record<string, number> {
  const entries = Object.entries(map ?? {});
  if (entries.length <= max) return { ...(map ?? {}) };
  entries.sort((a, b) => (a[0] < b[0] ? 1 : a[0] > b[0] ? -1 : 0));
  return Object.fromEntries(entries.slice(0, max));
}

/** Keep the `max` highest counts of a weakness map. Ties break by key. */
export function capWeaknesses(
  map: Record<string, number> | undefined,
  max = MAX_WEAKNESSES,
): Record<string, number> {
  const entries = Object.entries(map ?? {});
  if (entries.length <= max) return { ...(map ?? {}) };
  entries.sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  return Object.fromEntries(entries.slice(0, max));
}

/** Newer real calendar day. A missing or malformed day does not win. */
export function newerCalendarDay(a: unknown, b: unknown): string | null {
  const left = typeof a === "string" && isCalendarDay(a) ? a : null;
  const right = typeof b === "string" && isCalendarDay(b) ? b : null;
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

type MistakeLike = {
  id?: string;
  fen?: string;
  played?: string;
  best?: string;
  tag?: string;
  at?: number;
};

function mistakeKey(m: MistakeLike): string {
  if (typeof m.id === "string" && m.id) return `id:${m.id}`;
  return `${m.fen ?? ""}|${m.at ?? ""}`;
}

/** Positive when `a` outranks `b`. `at` is compared as a number, never as text. */
function compareMistakeRank(a: MistakeLike, b: MistakeLike): number {
  const atA = typeof a.at === "number" ? a.at : -Infinity;
  const atB = typeof b.at === "number" ? b.at : -Infinity;
  if (atA !== atB) return atA > atB ? 1 : -1;
  const textA = `${a.played ?? ""}|${a.best ?? ""}|${a.tag ?? ""}`;
  const textB = `${b.played ?? ""}|${b.best ?? ""}|${b.tag ?? ""}`;
  return textA > textB ? 1 : textA < textB ? -1 : 0;
}

/** An entry the log can keep: an object (not an array) with a string `fen`. */
export function isRecordedMistake(entry: unknown): entry is MistakeLike {
  return (
    entry !== null &&
    typeof entry === "object" &&
    !Array.isArray(entry) &&
    typeof (entry as { fen?: unknown }).fen === "string"
  );
}

/** Union by id or fen|at. A collision keeps the higher rank. Newest 30 by `at`. */
export function mergeMistakeLog(local: unknown, server: unknown): MistakeLike[] {
  const byKey = new Map<string, MistakeLike>();
  for (const entry of [...asMistakes(server), ...asMistakes(local)]) {
    const key = mistakeKey(entry);
    const prev = byKey.get(key);
    if (!prev || compareMistakeRank(entry, prev) > 0) byKey.set(key, entry);
  }
  return [...byKey.entries()]
    .sort(
      (a, b) =>
        (typeof b[1].at === "number" ? b[1].at : 0) -
          (typeof a[1].at === "number" ? a[1].at : 0) ||
        (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0),
    )
    .slice(0, 30)
    .map(([, entry]) => entry);
}

function asMistakes(value: unknown): MistakeLike[] {
  return Array.isArray(value) ? value.filter(isRecordedMistake) : [];
}

export type ProgressPushAck = {
  streak?: number;
  lastActiveDay?: string | null;
  rating?: number;
  ratingUpdatedAt?: number | null;
  dailyGoalXp?: number;
  goalUpdatedAt?: number | null;
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
};

function readWriterTimestamp(value: unknown): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number" && Number.isInteger(value) && value >= 0) return value;
  return undefined;
}

/** Fields an old `{ ok, count }` response does not carry. Absent fields are left alone. */
export function readProgressPushAck(body: unknown): ProgressPushAck | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const ack: ProgressPushAck = {};
  if (typeof raw.streak === "number" && Number.isFinite(raw.streak))
    ack.streak = raw.streak;
  if (typeof raw.lastActiveDay === "string" || raw.lastActiveDay === null) {
    ack.lastActiveDay = raw.lastActiveDay;
  }
  if (typeof raw.rating === "number" && Number.isFinite(raw.rating))
    ack.rating = raw.rating;
  const ratingUpdatedAt = readWriterTimestamp(raw.ratingUpdatedAt);
  if (ratingUpdatedAt !== undefined) ack.ratingUpdatedAt = ratingUpdatedAt;
  if (typeof raw.dailyGoalXp === "number" && Number.isFinite(raw.dailyGoalXp)) {
    ack.dailyGoalXp = raw.dailyGoalXp;
  }
  const goalUpdatedAt = readWriterTimestamp(raw.goalUpdatedAt);
  if (goalUpdatedAt !== undefined) ack.goalUpdatedAt = goalUpdatedAt;
  if (typeof raw.homeworkStreak === "number" && Number.isFinite(raw.homeworkStreak)) {
    ack.homeworkStreak = raw.homeworkStreak;
  }
  if (typeof raw.homeworkLastDay === "string" || raw.homeworkLastDay === null) {
    ack.homeworkLastDay = raw.homeworkLastDay;
  }
  return Object.keys(ack).length > 0 ? ack : null;
}

export function applyProgressPushAck<T extends Record<string, unknown>>(
  snap: T,
  body: unknown,
): T {
  const ack = readProgressPushAck(body);
  if (!ack) return snap;
  return { ...snap, ...ack };
}
