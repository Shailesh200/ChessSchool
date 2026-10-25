import { addDays, isCalendarDay, isoDay } from "@chess-school/progression";

/**
 * Length of the one-time streak grace window, counting the start day.
 * The start itself is only `STREAK_GRACE_START` (or a test override).
 * Unset or invalid means grace is off.
 */
export const STREAK_GRACE_WINDOW = {
  lengthDays: 7,
} as const;

/**
 * Server-owned grace record. Clients cannot set or clear it.
 * `lastSeenUtcDay` is the server UTC day of the last accepted activity push.
 * `graceUsedAt` is the server UTC day grace was consumed. Rows written before
 * this rename stored that day as `usedOn`; readers accept both and writers
 * emit `graceUsedAt` only.
 */
export type StreakGrace = {
  lastSeenUtcDay?: string;
  graceUsedAt?: string;
};

export type StreakGraceInput = {
  storedStreak: number;
  incomingStreak: number;
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
  /** Server UTC day. This is the only clock the gap uses. */
  today: string;
  /**
   * Test override for the window start. Omit it in production so
   * `STREAK_GRACE_START` is required. Invalid values disable grace.
   */
  graceStart?: string;
  /**
   * True when this push carries a real activity day the merge accepted.
   * Rejected days (malformed, or later than the server UTC day + 1) are
   * not stamped and cannot grant grace.
   */
  acceptedActivity: boolean;
};

export type MergedActivityDay = {
  lastActiveDay: string | null;
  /**
   * Incoming day is not a calendar day, or is later than the server UTC
   * day + 1. Callers keep the stored streak and skip grace.
   */
  rejectIncoming: boolean;
  /** Incoming day was accepted, so the server may stamp today. */
  acceptedActivity: boolean;
};

export function isRealIsoDay(value: string): boolean {
  return isCalendarDay(value);
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

function cappedStoredDay(stored: string | null, utcToday: string): string | null {
  if (!stored || !isCalendarDay(stored)) return null;
  if (!isCalendarDay(utcToday)) return stored;
  const latest = addDays(utcToday, 1);
  return stored > latest ? latest : stored;
}

/**
 * Pick the day the merge is allowed to store.
 * A malformed day is ignored. A day later than the server UTC day + 1 is
 * not stored, and a stored day already past that cap is clamped.
 * A push never moves a stored calendar day backwards.
 *
 * This is the storage rule only. Grace does not read the result: the gap
 * comes from the server UTC stamp, and there is no ±1 timezone slack.
 */
export function mergeActivityDay(
  incoming: string | null,
  stored: string | null,
  utcToday: string,
): MergedActivityDay {
  if (!isCalendarDay(utcToday)) {
    return {
      lastActiveDay: stored && isCalendarDay(stored) ? stored : null,
      rejectIncoming: true,
      acceptedActivity: false,
    };
  }
  if (incoming != null && !isCalendarDay(incoming)) {
    return {
      lastActiveDay: cappedStoredDay(stored, utcToday),
      rejectIncoming: true,
      acceptedActivity: false,
    };
  }
  if (incoming && incoming > addDays(utcToday, 1)) {
    return {
      lastActiveDay: cappedStoredDay(stored, utcToday),
      rejectIncoming: true,
      acceptedActivity: false,
    };
  }
  if (incoming && isCalendarDay(incoming)) {
    if (stored && isCalendarDay(stored) && stored > incoming) {
      return {
        lastActiveDay: cappedStoredDay(stored, utcToday),
        rejectIncoming: false,
        acceptedActivity: true,
      };
    }
    return {
      lastActiveDay: incoming,
      rejectIncoming: false,
      acceptedActivity: true,
    };
  }
  return {
    lastActiveDay: cappedStoredDay(stored, utcToday),
    rejectIncoming: false,
    acceptedActivity: false,
  };
}

function realDay(value: unknown): string | undefined {
  return typeof value === "string" && isRealIsoDay(value) ? value : undefined;
}

/**
 * A stored flag counts as used when the server wrote `graceUsedAt` or the
 * legacy `usedOn`. The returned object is the shape writers persist.
 */
export function readStoredStreakGrace(value: unknown): StreakGrace | undefined {
  if (!value || typeof value !== "object") return undefined;
  const raw = value as {
    graceUsedAt?: unknown;
    usedOn?: unknown;
    lastSeenUtcDay?: unknown;
  };
  const graceUsedAt = realDay(raw.graceUsedAt) ?? realDay(raw.usedOn);
  const lastSeenUtcDay = realDay(raw.lastSeenUtcDay);
  if (!graceUsedAt && !lastSeenUtcDay) return undefined;
  return {
    ...(lastSeenUtcDay ? { lastSeenUtcDay } : {}),
    ...(graceUsedAt ? { graceUsedAt } : {}),
  };
}

/**
 * True when the server stamp is exactly two UTC days behind `today`
 * (yesterday was missed). There is no timezone slack: both days are the
 * server's own UTC calendar, so a client zone cannot widen the gap.
 * No stamp means no grace — the client's lastActiveDay is not a substitute.
 */
export function isExactlyOneMissedServerDay(
  lastSeenUtcDay: string | undefined,
  today: string,
): boolean {
  if (!lastSeenUtcDay || !isCalendarDay(today)) return false;
  return lastSeenUtcDay === addDays(today, -2);
}

/**
 * Continue a streak after exactly one missed server UTC day, at most once.
 * The gap is `lastSeenUtcDay` versus `today` only. `graceUsedAt` is the
 * server UTC day grace was used (legacy `usedOn` already counts as used).
 * An accepted push always restamps `lastSeenUtcDay` to today.
 */
export function applyOneTimeStreakGrace(input: StreakGraceInput): {
  streak: number;
  streakGrace?: StreakGrace;
} {
  const storedGrace = readStoredStreakGrace(input.storedGrace);
  const unchanged = { streak: input.mergedStreak, streakGrace: storedGrace };

  if (!input.acceptedActivity || !isCalendarDay(input.today)) return unchanged;

  const stamped: StreakGrace = {
    ...(storedGrace?.graceUsedAt ? { graceUsedAt: storedGrace.graceUsedAt } : {}),
    lastSeenUtcDay: input.today,
  };
  const kept = { streak: input.mergedStreak, streakGrace: stamped };

  if (storedGrace?.graceUsedAt) return kept;

  const start = streakGraceStart(input.graceStart);
  if (!start || !isInsideStreakGraceWindow(input.today, start)) return kept;

  if (!isExactlyOneMissedServerDay(storedGrace?.lastSeenUtcDay, input.today)) {
    return kept;
  }

  if (input.storedStreak < 1) return kept;
  if (input.incomingStreak > 1) return kept;

  return {
    streak: input.storedStreak + 1,
    streakGrace: { graceUsedAt: input.today, lastSeenUtcDay: input.today },
  };
}
