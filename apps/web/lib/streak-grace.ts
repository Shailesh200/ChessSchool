import {
  addDays,
  calendarDay,
  isCalendarDay,
  resolveRequestedDay,
} from "@chess-school/progression";

/**
 * Length of the one-time streak grace window, counting the start day.
 * The start itself is only `STREAK_GRACE_START` (or a test override).
 * Unset or invalid means grace is off.
 */
export const STREAK_GRACE_WINDOW = {
  lengthDays: 7,
} as const;

/** How many server days of streak history we keep. */
export const STREAK_ACTIVE_DAY_LIMIT = 60;

/**
 * Server-owned streak record in `progress.data`. Clients cannot write it.
 *
 * `activeDays` is the set of local days that counted as streak activity,
 * oldest first, capped at {@link STREAK_ACTIVE_DAY_LIMIT}. A day is recorded
 * only when it is the client's local day and sits in the server UTC day ±1,
 * the same window as `?day=`. D2c will key this by the stored device zone.
 *
 * `graceUsedAt` is the server UTC day grace was consumed. Rows written
 * before this rename stored that day as `usedOn`. `graceCoveredDay` is the
 * single missed day that grace is bridging. A later activity push that
 * records that day clears both fields so grace can be used again.
 */
export type StreakGrace = {
  activeDays?: string[];
  graceUsedAt?: string;
  graceCoveredDay?: string;
};

export type StreakActivityView = {
  xp: number;
  botWins?: number;
  lessons?: Record<string, { attempts?: number; mastery?: number } | undefined>;
  dailyPuzzleDay?: string | null;
  recentGames?: unknown[] | null;
};

/**
 * Signals we can see by diffing the stored snapshot with the push.
 * Progress is client-reported, so an increase is treated as play:
 * - XP went up
 * - botWins went up
 * - a lesson gained attempts or mastery, or a new lesson has either
 * - dailyPuzzleDay changed to a different real calendar day
 * - recentGames gained an id (or a new JSON payload when there is no id)
 *
 * Settings, plan, homework, and journal fields are not signals. A higher
 * counter without a server-recorded completion still counts; checking the
 * completion itself is follow-up D5.
 */
export function recordsStreakActivity(
  incoming: StreakActivityView,
  stored: StreakActivityView,
): boolean {
  if (incoming.xp > stored.xp) return true;
  if (incoming.botWins != null && incoming.botWins > (stored.botWins ?? 0)) return true;
  if (lessonsIncreased(incoming.lessons, stored.lessons)) return true;
  if (
    incoming.dailyPuzzleDay &&
    isCalendarDay(incoming.dailyPuzzleDay) &&
    incoming.dailyPuzzleDay !== (stored.dailyPuzzleDay ?? null)
  ) {
    return true;
  }
  return hasNewGame(incoming.recentGames, stored.recentGames);
}

/** UTC calendar day. Same clock as `resolveRequestedDay` and `lastActiveDayBeyondServer`. */
export function serverUtcDay(now = new Date()): string {
  return calendarDay(now, "UTC");
}

/** Noon UTC on a server day, so the merge clamp and grace share one calendar. */
export function clockForServerDay(today: string): Date {
  return isCalendarDay(today) ? new Date(`${today}T12:00:00.000Z`) : new Date();
}

/**
 * Window start from an explicit override or `STREAK_GRACE_START`.
 * `null` means grace is disabled (fail closed). There is no built-in date.
 */
export function streakGraceStart(override?: string): string | null {
  const candidate = override !== undefined ? override : process.env.STREAK_GRACE_START;
  const trimmed = candidate?.trim() ?? "";
  return trimmed && isCalendarDay(trimmed) ? trimmed : null;
}

export function isInsideStreakGraceWindow(day: string, start: string): boolean {
  if (!isCalendarDay(day) || !isCalendarDay(start)) return false;
  const end = addDays(start, STREAK_GRACE_WINDOW.lengthDays - 1);
  return day >= start && day <= end;
}

function realDay(value: unknown): string | undefined {
  return typeof value === "string" && isCalendarDay(value) ? value : undefined;
}

export type ParsedStreakGrace = {
  /** True when the stored object has an `activeDays` array, even if empty. */
  hasActiveDays: boolean;
  grace?: StreakGrace;
};

/** Read a server record. Legacy `usedOn` becomes `graceUsedAt`. */
export function parseStreakGrace(value: unknown): ParsedStreakGrace {
  if (!value || typeof value !== "object") return { hasActiveDays: false };
  const raw = value as {
    activeDays?: unknown;
    graceUsedAt?: unknown;
    graceCoveredDay?: unknown;
    usedOn?: unknown;
  };
  const activeDayList = Array.isArray(raw.activeDays) ? raw.activeDays : undefined;
  const hasActiveDays = activeDayList !== undefined;
  const activeDays = activeDayList
    ? uniqueDays(activeDayList.filter((day): day is string => typeof day === "string"))
    : undefined;
  const graceUsedAt = realDay(raw.graceUsedAt) ?? realDay(raw.usedOn);
  const graceCoveredDay = realDay(raw.graceCoveredDay);
  if (!hasActiveDays && !graceUsedAt && !graceCoveredDay)
    return { hasActiveDays: false };
  return {
    hasActiveDays,
    grace: {
      ...(activeDays ? { activeDays } : {}),
      ...(graceUsedAt ? { graceUsedAt } : {}),
      ...(graceCoveredDay ? { graceCoveredDay } : {}),
    },
  };
}

export function readStoredStreakGrace(value: unknown): StreakGrace | undefined {
  return parseStreakGrace(value).grace;
}

export type ReconcileStreakInput = {
  hasActiveDays: boolean;
  activeDays?: string[];
  graceUsedAt?: string;
  graceCoveredDay?: string;
  storedLastActiveDay: string | null;
  storedStreak: number;
  today: string;
  graceStart?: string;
  /**
   * Client `lastActiveDay`, the local day this push claims. It is recorded
   * only when it is inside the server UTC day ±1, and only when it is not
   * older than the newest day already stored. The day before it is not
   * inserted; grace is the only way that hole counts.
   */
  claimedDay: string | null;
  /**
   * Activity may spend grace on one hole. A push that is not activity
   * recomputes the streak but does not spend grace. Defaults to true.
   */
  grantGrace?: boolean;
};

export type ReconcileStreakResult = {
  streak: number;
  streakGrace: StreakGrace;
};

/**
 * Rebuild the streak from the server's active-day set.
 *
 * An activity push may add `claimedDay` only when that local day is inside
 * the server UTC day ±1 (`input.today` is the server UTC day). That single
 * day is the push's today. A claim older than the newest stored day is
 * ignored, so yesterday cannot be backfilled behind today. One missed day
 * counts only through grace. The set is capped at the last
 * {@link STREAK_ACTIVE_DAY_LIMIT} days.
 *
 * The streak run ends on the local day just recorded, or on the server UTC
 * day — or on that day + 1 when the set already holds it, so an early-morning
 * local day is not dropped. Grace, once, counts exactly one missing day.
 * A day already covered still counts on later pushes. That hole sits behind
 * the newest stored day, so a later push cannot record it.
 *
 * The first set is seeded from `storedStreak` consecutive days ending at
 * `storedLastActiveDay`, including on a push that is not activity. Callers
 * pass the server streak, never the client number. A non-activity push
 * passes no claimed day and does not grant grace. The returned streak is
 * the run those days support.
 *
 * Returns null when there is no set to seed and this push does not add a
 * day, so the caller keeps the server streak.
 */
export function reconcileActiveStreak(
  input: ReconcileStreakInput,
): ReconcileStreakResult | null {
  if (!isCalendarDay(input.today)) return null;
  const recordable = recordableActivityDay(input.claimedDay, input.today);
  const seedCap = recordable && recordable > input.today ? recordable : input.today;
  const seeded = input.hasActiveDays
    ? (input.activeDays ?? [])
    : seedActiveDays(input.storedLastActiveDay, input.storedStreak, seedCap);
  if (!input.hasActiveDays && seeded.length === 0 && !recordable) return null;

  const base = uniqueDays(seeded);
  const latest = base.length > 0 ? base[base.length - 1] : null;
  // A claim earlier than the newest recorded day would backfill a miss.
  const added = claimedDayOnOrAfterLatest(recordable, latest);
  const ahead = addDays(input.today, 1);
  const anchor = added ?? (base.includes(ahead) ? ahead : input.today);
  const days = boundActiveDays(added ? [...base, added] : base, anchor);

  let graceUsedAt = input.graceUsedAt;
  let covered = input.graceCoveredDay;

  const start = streakGraceStart(input.graceStart);
  const allowGrace =
    input.grantGrace !== false &&
    !graceUsedAt &&
    !!start &&
    isInsideStreakGraceWindow(anchor, start);
  const computed = recomputeStreakFromActiveDays(days, anchor, {
    allowGrace,
    graceCoveredDay: covered,
    graceNotBefore: start ?? undefined,
  });
  if (computed.coveredDay && computed.coveredDay !== covered) {
    graceUsedAt = anchor;
    covered = computed.coveredDay;
  }

  return {
    streak: computed.streak,
    streakGrace: {
      activeDays: days,
      ...(graceUsedAt ? { graceUsedAt } : {}),
      ...(graceUsedAt && covered ? { graceCoveredDay: covered } : {}),
    },
  };
}

/**
 * Client local day if it sits in the server UTC day ±1.
 * Same window as `resolveRequestedDay`. A day outside that window is
 * rejected. The caller adds this day only, and not when it is older than
 * the newest day already stored.
 */
export function recordableActivityDay(
  claimed: string | null,
  serverUtc: string,
): string | null {
  if (!isCalendarDay(serverUtc) || !claimed) return null;
  return resolveRequestedDay(claimed, clockForServerDay(serverUtc));
}

/** Drop a claim that is earlier than the newest day already recorded. */
function claimedDayOnOrAfterLatest(
  claimed: string | null,
  latest: string | null,
): string | null {
  if (!claimed) return null;
  if (latest !== null && claimed < latest) return null;
  return claimed;
}

function seedActiveDays(
  lastActiveDay: string | null,
  streak: number,
  today: string,
): string[] {
  if (!lastActiveDay || !isCalendarDay(lastActiveDay) || lastActiveDay > today)
    return [];
  const count = Math.max(0, Math.min(Math.floor(streak), STREAK_ACTIVE_DAY_LIMIT));
  const days: string[] = [];
  for (let i = 0; i < count; i++) days.push(addDays(lastActiveDay, -i));
  return days;
}

function boundActiveDays(days: string[], today: string): string[] {
  const earliest = addDays(today, -(STREAK_ACTIVE_DAY_LIMIT - 1));
  return uniqueDays(days).filter((day) => day >= earliest && day <= today);
}

function uniqueDays(days: readonly string[]): string[] {
  return [...new Set(days.filter((day) => isCalendarDay(day)))].sort();
}

export type ActiveDayStreak = {
  streak: number;
  /** Missed day grace is bridging. Absent when the run has no hole. */
  coveredDay?: string;
};

/**
 * Streak implied by the server's stored active days.
 *
 * #44 calls this. It does not read a client streak. The run ends on `today`,
 * or on the previous day when `today` is empty. `allowGrace` counts exactly
 * one hole whose previous day is present and whose day is on or after
 * `graceNotBefore` (the window start). `graceCoveredDay` still counts
 * after grace was already spent, and does not open a second hole.
 */
export function recomputeStreakFromActiveDays(
  activeDays: readonly string[],
  today: string,
  options?: {
    allowGrace?: boolean;
    graceCoveredDay?: string;
    /** Missed day must be on or after this calendar day to be bridged. */
    graceNotBefore?: string;
  },
): ActiveDayStreak {
  if (!isCalendarDay(today)) return { streak: 0 };
  const days = uniqueDays(activeDays);
  const covered =
    options?.graceCoveredDay &&
    isCalendarDay(options.graceCoveredDay) &&
    !days.includes(options.graceCoveredDay)
      ? options.graceCoveredDay
      : undefined;
  const counting = covered ? [...days, covered] : days;
  const notBefore =
    options?.graceNotBefore && isCalendarDay(options.graceNotBefore)
      ? options.graceNotBefore
      : undefined;
  const computed = streakFromActiveDays(
    counting,
    today,
    Boolean(options?.allowGrace) && !covered,
    notBefore,
  );
  if (covered) return { streak: computed.streak, coveredDay: covered };
  return computed;
}

/**
 * Count the run ending today, or yesterday if today has no activity.
 * With grace, exactly one hole whose previous day is present counts too,
 * and only when that hole is on or after `notBefore`. Filling that hole
 * later does not change the length.
 */
function streakFromActiveDays(
  days: string[],
  today: string,
  allowGrace: boolean,
  notBefore?: string,
): { streak: number; coveredDay?: string } {
  const present = new Set(days);
  const yesterday = addDays(today, -1);
  let cursor: string | null = present.has(today)
    ? today
    : present.has(yesterday)
      ? yesterday
      : null;
  if (!cursor) return { streak: 0 };

  let streak = 0;
  let bridged = false;
  let coveredDay: string | undefined;
  for (let step = 0; step < STREAK_ACTIVE_DAY_LIMIT + 2 && cursor; step++) {
    if (present.has(cursor)) {
      streak += 1;
      cursor = addDays(cursor, -1);
      continue;
    }
    const prev = addDays(cursor, -1);
    if (
      allowGrace &&
      !bridged &&
      present.has(prev) &&
      (notBefore === undefined || cursor >= notBefore)
    ) {
      bridged = true;
      coveredDay = cursor;
      streak += 1;
      cursor = prev;
      continue;
    }
    break;
  }
  return { streak, coveredDay };
}

function lessonsIncreased(
  incoming: StreakActivityView["lessons"],
  stored: StreakActivityView["lessons"],
): boolean {
  if (!incoming) return false;
  for (const [id, rec] of Object.entries(incoming)) {
    if (!rec) continue;
    const attempts = rec.attempts ?? 0;
    const mastery = rec.mastery ?? 0;
    const prev = stored?.[id];
    if (!prev) {
      if (attempts > 0 || mastery > 0) return true;
    } else if (attempts > (prev.attempts ?? 0) || mastery > (prev.mastery ?? 0)) {
      return true;
    }
  }
  return false;
}

function hasNewGame(
  incoming: StreakActivityView["recentGames"],
  stored: StreakActivityView["recentGames"],
): boolean {
  if (!incoming || incoming.length === 0) return false;
  const seen = new Set((stored ?? []).map(gameKey));
  return incoming.some((game) => !seen.has(gameKey(game)));
}

function gameKey(game: unknown): string {
  if (game && typeof game === "object" && "id" in game) {
    const id = (game as { id?: unknown }).id;
    if (typeof id === "string" || typeof id === "number") return `id:${id}`;
  }
  return `json:${JSON.stringify(game)}`;
}
