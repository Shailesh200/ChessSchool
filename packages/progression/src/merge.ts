import { addDays } from "./day";

/**
 * How far past the server calendar day a client `lastActiveDay` may sit.
 * UTC+14 is the next UTC date; a day further out is not a real local day.
 */
export const ACTIVE_DAY_FUTURE_SLACK = 1;

export type ActiveDayPolicy = {
  /**
   * Server calendar day (UTC on Vercel). When set, a day later than
   * `today + ACTIVE_DAY_FUTURE_SLACK` is ignored and cannot win recency.
   */
  today?: string;
};

type LessonRec = {
  mastery: number;
  attempts: number;
  lastSeen: number;
  dueAt: number;
  incorrect?: number;
};

type MistakeLike = {
  id?: string;
  fen?: string;
  played?: string;
  best?: string;
  tag?: string;
  at?: number;
};

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isIsoDay(value: unknown): value is string {
  if (typeof value !== "string" || !ISO_DAY.test(value)) return false;
  return addDays(value, 0) === value;
}

/** A real calendar day that is allowed to win recency and be stored. */
export function acceptableActiveDay(
  day: unknown,
  policy?: ActiveDayPolicy,
): string | null {
  if (!isIsoDay(day)) return null;
  if (policy?.today && isIsoDay(policy.today)) {
    const cap = addDays(policy.today, ACTIVE_DAY_FUTURE_SLACK);
    if (day > cap) return null;
  }
  return day;
}

/**
 * Streak and its day come from the side with the newer acceptable day.
 * The same day (or two missing days) keeps the larger streak, so a same-day
 * push cannot undo a server-applied grace the client has not seen yet.
 */
export function pickStreakByRecency(
  local: { streak: number; day: unknown },
  server: { streak: number; day: unknown },
  policy?: ActiveDayPolicy,
): { streak: number; day: string | null } {
  const localDay = acceptableActiveDay(local.day, policy);
  const serverDay = acceptableActiveDay(server.day, policy);
  const localStreak = Number.isFinite(local.streak) ? local.streak : 0;
  const serverStreak = Number.isFinite(server.streak) ? server.streak : 0;
  if (localDay && (!serverDay || localDay > serverDay)) {
    return { streak: localStreak, day: localDay };
  }
  if (serverDay && (!localDay || serverDay > localDay)) {
    return { streak: serverStreak, day: serverDay };
  }
  return { streak: Math.max(localStreak, serverStreak), day: localDay ?? serverDay };
}

function timestampOf(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value;
}

/**
 * Last writer wins by an integer timestamp. A missing timestamp never beats
 * a present one. When both are missing, or they tie, `max` keeps the old
 * behaviour so clients that do not send timestamps do not regress.
 */
export function pickLastWriterNumber(
  localValue: number,
  localAt: unknown,
  serverValue: number,
  serverAt: unknown,
): { value: number; at: number | null } {
  const localStamp = timestampOf(localAt);
  const serverStamp = timestampOf(serverAt);
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

export function newerIsoDay(a: unknown, b: unknown): string | null {
  const left = isIsoDay(a) ? a : null;
  const right = isIsoDay(b) ? b : null;
  if (!left) return right;
  if (!right) return left;
  return left >= right ? left : right;
}

function mistakeKey(m: MistakeLike): string {
  if (typeof m.id === "string" && m.id) return `id:${m.id}`;
  return `${m.fen ?? ""}|${m.at ?? ""}`;
}

function mistakeRank(m: MistakeLike): string {
  const at = typeof m.at === "number" && Number.isFinite(m.at) ? m.at : 0;
  return `${String(Math.trunc(at)).padStart(16, "0")}|${m.played ?? ""}|${m.best ?? ""}|${m.tag ?? ""}`;
}

/** Union by id or fen|at. Keep the newest 30 by `at` (rank breaks ties). */
export function mergeMistakeLog(local: unknown[] = [], server: unknown[] = []): MistakeLike[] {
  const best = new Map<string, MistakeLike>();
  for (const raw of [...local, ...server]) {
    if (!raw || typeof raw !== "object") continue;
    const mistake = raw as MistakeLike;
    const key = mistakeKey(mistake);
    const prev = best.get(key);
    if (!prev || mistakeRank(mistake) > mistakeRank(prev)) best.set(key, mistake);
  }
  return [...best.values()]
    .sort((a, b) => {
      const at = (b.at ?? 0) - (a.at ?? 0);
      if (at !== 0) return at;
      const key = mistakeKey(a) < mistakeKey(b) ? -1 : mistakeKey(a) > mistakeKey(b) ? 1 : 0;
      return key;
    })
    .slice(0, 30);
}

export function mergeLessonRecords(
  local: Record<string, LessonRec> = {},
  server: Record<string, LessonRec> = {},
): Record<string, LessonRec> {
  const lessons: Record<string, LessonRec> = { ...local };
  for (const [id, incoming] of Object.entries(server)) {
    const cur = lessons[id];
    if (!cur) {
      lessons[id] = incoming;
      continue;
    }
    const attempts = Math.max(cur.attempts ?? 0, incoming.attempts ?? 0);
    if (incoming.mastery > cur.mastery) {
      lessons[id] = { ...incoming, attempts };
      continue;
    }
    if (cur.mastery > incoming.mastery) {
      lessons[id] = { ...cur, attempts };
      continue;
    }
    const incorrect =
      cur.incorrect === undefined
        ? incoming.incorrect
        : incoming.incorrect === undefined
          ? cur.incorrect
          : Math.min(cur.incorrect, incoming.incorrect);
    lessons[id] = {
      mastery: cur.mastery,
      attempts,
      lastSeen: Math.max(cur.lastSeen ?? 0, incoming.lastSeen ?? 0),
      dueAt: Math.max(cur.dueAt ?? 0, incoming.dueAt ?? 0),
      ...(incorrect !== undefined ? { incorrect } : {}),
    };
  }
  return lessons;
}

export type ProgressPushAck = {
  streak?: number;
  lastActiveDay?: string | null;
  rating?: number;
  dailyGoalXp?: number;
  homeworkStreak?: number;
};

/** Fields an old `{ ok, count }` response does not carry. Absent fields are left alone. */
export function readProgressPushAck(body: unknown): ProgressPushAck | null {
  if (!body || typeof body !== "object") return null;
  const raw = body as Record<string, unknown>;
  const ack: ProgressPushAck = {};
  if (typeof raw.streak === "number" && Number.isFinite(raw.streak)) ack.streak = raw.streak;
  if (typeof raw.lastActiveDay === "string" || raw.lastActiveDay === null) {
    ack.lastActiveDay = raw.lastActiveDay;
  }
  if (typeof raw.rating === "number" && Number.isFinite(raw.rating)) ack.rating = raw.rating;
  if (typeof raw.dailyGoalXp === "number" && Number.isFinite(raw.dailyGoalXp)) {
    ack.dailyGoalXp = raw.dailyGoalXp;
  }
  if (typeof raw.homeworkStreak === "number" && Number.isFinite(raw.homeworkStreak)) {
    ack.homeworkStreak = raw.homeworkStreak;
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
