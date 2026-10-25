import { addDays, isoDay } from "@chess-school/progression";

const ISO_DAY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Length of the one-time streak grace window, counting the start day.
 * The start itself is only `STREAK_GRACE_START` (or a test override).
 * Unset or invalid means grace is off.
 */
export const STREAK_GRACE_WINDOW = {
  lengthDays: 7,
} as const;

/** Server-owned marker. Written only by `applyOneTimeStreakGrace`. */
export type StreakGrace = { usedOn: string };

export type StreakGraceInput = {
  storedStreak: number;
  storedLastActiveDay: string | null;
  incomingStreak: number;
  incomingLastActiveDay: string | null;
  /**
   * Streak already chosen by the snapshot merge.
   * Today that is max(stored, incoming), which hides a reset (D-3).
   * D3 will switch this to the streak on the side with the newer
   * `lastActiveDay`, with the larger streak winning a same-day tie.
   * Grace replaces this number only when the one-time rule matches.
   * Otherwise it is returned unchanged.
   */
  mergedStreak: number;
  storedGrace?: StreakGrace | null;
  /** Server UTC day the window and the ±1 skew check use. */
  today: string;
  /**
   * Test override for the window start. Omit it in production so
   * `STREAK_GRACE_START` is required. Invalid values disable grace.
   */
  graceStart?: string;
};

export type MergedActivityDay = {
  lastActiveDay: string | null;
  /**
   * Incoming day is missing a strict calendar form, or is later than the
   * server UTC day + 1. Callers keep the stored streak and skip grace.
   */
  rejectIncoming: boolean;
};

export function isRealIsoDay(value: string): boolean {
  if (!ISO_DAY.test(value)) return false;
  // Reject overflow dates such as 2026-02-30. `addDays` anchors at UTC noon.
  return addDays(value, 0) === value;
}

/** UTC calendar day. Vercel is UTC; this does not follow the host zone. */
export function serverUtcDay(now = new Date()): string {
  return isoDay(now, "UTC");
}

/**
 * Window start from an explicit override or `STREAK_GRACE_START`.
 * `null` means grace is disabled (fail closed). There is no built-in date.
 */
export function streakGraceStart(override?: string): string | null {
  const candidate = override !== undefined ? override : process.env.STREAK_GRACE_START;
  const trimmed = candidate?.trim() ?? "";
  return trimmed && isRealIsoDay(trimmed) ? trimmed : null;
}

export function isInsideStreakGraceWindow(day: string, start: string): boolean {
  if (!isRealIsoDay(day) || !isRealIsoDay(start)) return false;
  const end = addDays(start, STREAK_GRACE_WINDOW.lengthDays - 1);
  return day >= start && day <= end;
}

/** Local play can fall on the UTC day, the day before, or the day after. */
export function isWithinServerUtcSkew(day: string | null, utcToday: string): boolean {
  if (!day || !isRealIsoDay(day) || !isRealIsoDay(utcToday)) return false;
  return day >= addDays(utcToday, -1) && day <= addDays(utcToday, 1);
}

/**
 * Pick the day the merge is allowed to store.
 * A malformed incoming day is ignored. A day later than UTC tomorrow is
 * not stored; a stored day that is already past that cap is clamped to it.
 */
export function mergeActivityDay(
  incoming: string | null,
  stored: string | null,
  utcToday: string,
): MergedActivityDay {
  if (!isRealIsoDay(utcToday)) {
    return {
      lastActiveDay: stored && isRealIsoDay(stored) ? stored : null,
      rejectIncoming: true,
    };
  }
  const latest = addDays(utcToday, 1);
  const capped = (day: string | null): string | null => {
    if (!day || !isRealIsoDay(day)) return null;
    return day > latest ? latest : day;
  };
  if (incoming != null && !isRealIsoDay(incoming)) {
    return { lastActiveDay: capped(stored), rejectIncoming: true };
  }
  if (incoming && isRealIsoDay(incoming) && incoming > latest) {
    return { lastActiveDay: capped(stored), rejectIncoming: true };
  }
  if (incoming && isRealIsoDay(incoming)) {
    return { lastActiveDay: capped(incoming), rejectIncoming: false };
  }
  return { lastActiveDay: capped(stored), rejectIncoming: false };
}

/** A stored flag counts as used only when the server wrote a real day. */
export function readStoredStreakGrace(value: unknown): StreakGrace | undefined {
  if (!value || typeof value !== "object") return undefined;
  const usedOn = (value as { usedOn?: unknown }).usedOn;
  if (typeof usedOn !== "string" || !isRealIsoDay(usedOn)) return undefined;
  return { usedOn };
}

function isExactlyOneMissedDay(
  storedDay: string | null,
  incomingDay: string | null,
): boolean {
  if (!storedDay || !incomingDay) return false;
  if (!isRealIsoDay(storedDay) || !isRealIsoDay(incomingDay)) return false;
  // stored 2026-10-20 and incoming 2026-10-22 misses exactly 2026-10-21.
  return addDays(storedDay, 2) === incomingDay;
}

/**
 * Continue a streak that reset after exactly one missed calendar day.
 * At most once per user, only inside the grace window, and only when the
 * incoming day is a real `YYYY-MM-DD` within the server UTC day ±1.
 * The returned `streakGrace` is always the server's — never a client value.
 */
export function applyOneTimeStreakGrace(input: StreakGraceInput): {
  streak: number;
  streakGrace?: StreakGrace;
} {
  const storedGrace = readStoredStreakGrace(input.storedGrace);
  const unchanged = { streak: input.mergedStreak, streakGrace: storedGrace };

  if (storedGrace) return unchanged;

  const start = streakGraceStart(input.graceStart);
  if (!start || !isInsideStreakGraceWindow(input.today, start)) return unchanged;

  if (!isWithinServerUtcSkew(input.incomingLastActiveDay, input.today))
    return unchanged;

  if (!isExactlyOneMissedDay(input.storedLastActiveDay, input.incomingLastActiveDay)) {
    return unchanged;
  }

  if (input.storedStreak < 1) return unchanged;
  if (input.incomingStreak > 1) return unchanged;

  return {
    streak: input.storedStreak + 1,
    streakGrace: { usedOn: input.today },
  };
}
