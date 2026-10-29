import {
  addDays,
  canonicalTimeZone,
  isCalendarDay,
  mergeProgressSnapshots,
  newerCalendarDay,
  normalizeProgressPush,
  type Snap,
} from "@chess-school/progression";
import type { ProgressPushBody } from "@/lib/api-schemas";
import {
  clockForServerDay,
  parseStreakGrace,
  readStoredStreakGrace,
  reconcileActiveStreak,
  recordsStreakActivity,
  serverUtcDay,
  type StreakGrace,
} from "@/lib/streak-grace";

export type LessonRec = {
  mastery: number;
  attempts: number;
  lastSeen: number;
  dueAt: number;
  incorrect?: number;
};

/** Extended fields stored in progress.data (JSON). */
export type ExtraProgressData = {
  rating?: number;
  botWins?: number;
  dailyGoalXp?: number;
  unlockedAchievements?: string[];
  schoolExamsPassed?: string[];
  weaknesses?: Record<string, number>;
  activityDays?: Record<string, number>;
  mistakeLog?: unknown[];
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
  recentGames?: unknown[];
  dailyPuzzleDay?: string | null;
  settings?: Record<string, unknown>;
  homeworkDone?: Record<string, string[]>;
  placementDone?: boolean;
  journalEntries?: unknown[];
  /** Last writer of `rating`. Lives in progress.data. Absent when neither side sent one. */
  ratingUpdatedAt?: number;
  /** Last writer of `dailyGoalXp`. Lives in progress.data. */
  goalUpdatedAt?: number;
  /** Canonical IANA zone from the client. Stored for a later day key. Not used yet. */
  tz?: string;
  /**
   * Server-owned streak days and one-time grace. Merge never copies a
   * client-sent `streakGrace`. The first push of any kind seeds `activeDays`
   * from the server streak. Only an activity push adds a day or spends grace.
   */

  streakGrace?: StreakGrace;
};

export type ServerProgressState = {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  dailyGoalXp: number;
  graduatedClasses: string[];
  lessons: Record<string, LessonRec>;
  extra: ExtraProgressData;
};

export type MergedProgressWrite = {
  xp: number;
  streak: number;
  lastActiveDay: string | null;
  dailyGoalXp: number;
  graduatedClasses: string[];
  data: ExtraProgressData;
  lessons: Record<string, LessonRec>;
};

export function parseExtraData(raw: string | null | undefined): ExtraProgressData {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ExtraProgressData;
  } catch {
    return {};
  }
}

export function parseGraduatedClasses(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

export function serverStateFromRow(
  row:
    | {
        xp: number;
        streak: number;
        lastActiveDay: string | null;
        dailyGoalXp: number;
        graduatedClasses: string;
        data: string;
      }
    | undefined,
  recs: Array<{
    lessonId: string;
    mastery: number;
    attempts: number;
    lastSeen: number;
    dueAt: number;
  }>,
): ServerProgressState {
  const lessons: Record<string, LessonRec> = {};
  for (const r of recs) {
    lessons[r.lessonId] = {
      mastery: r.mastery,
      attempts: r.attempts,
      lastSeen: r.lastSeen,
      dueAt: r.dueAt,
    };
  }
  const extra = parseExtraData(row?.data);
  return {
    xp: row?.xp ?? 0,
    streak: row?.streak ?? 0,
    lastActiveDay: row?.lastActiveDay ?? null,
    dailyGoalXp: row?.dailyGoalXp ?? 50,
    graduatedClasses: parseGraduatedClasses(row?.graduatedClasses),
    lessons,
    extra,
  };
}

function snapFromServer(
  state: ServerProgressState,
): Snap & { placementDone?: boolean } {
  return normalizeProgressPush({
    xp: state.xp,
    streak: state.streak,
    lastActiveDay: state.lastActiveDay,
    graduatedClasses: state.graduatedClasses,
    lessons: state.lessons,
    dailyGoalXp: state.extra.dailyGoalXp ?? state.dailyGoalXp,
    rating: state.extra.rating,
    botWins: state.extra.botWins,
    unlockedAchievements: state.extra.unlockedAchievements,
    schoolExamsPassed: state.extra.schoolExamsPassed,
    weaknesses: state.extra.weaknesses,
    activityDays: state.extra.activityDays,
    mistakeLog: state.extra.mistakeLog as Snap["mistakeLog"],
    homeworkStreak: state.extra.homeworkStreak,
    homeworkLastDay: state.extra.homeworkLastDay,
    recentGames: state.extra.recentGames,
    dailyPuzzleDay: state.extra.dailyPuzzleDay,
    homeworkDone: state.extra.homeworkDone,
    placementDone: state.extra.placementDone,
    journalEntries: state.extra.journalEntries,
    settings: state.extra.settings,
    ratingUpdatedAt: state.extra.ratingUpdatedAt,
    goalUpdatedAt: state.extra.goalUpdatedAt,
    tz: state.extra.tz,
  });
}

function snapFromPush(body: ProgressPushBody): Snap & { placementDone?: boolean } {
  return normalizeProgressPush({
    xp: body.xp,
    streak: body.streak,
    lastActiveDay: body.lastActiveDay,
    graduatedClasses: body.graduatedClasses,
    lessons: body.lessons,
    dailyGoalXp: body.dailyGoalXp,
    rating: body.rating,
    botWins: body.botWins,
    unlockedAchievements: body.unlockedAchievements,
    schoolExamsPassed: body.schoolExamsPassed,
    weaknesses: body.weaknesses,
    activityDays: body.activityDays,
    mistakeLog: body.mistakeLog as Snap["mistakeLog"],
    homeworkStreak: body.homeworkStreak,
    homeworkLastDay: body.homeworkLastDay,
    recentGames: body.recentGames,
    dailyPuzzleDay: body.dailyPuzzleDay,
    homeworkDone: body.homeworkDone,
    placementDone: body.placementDone,
    journalEntries: body.journalEntries,
    settings: body.settings,
    ratingUpdatedAt: body.ratingUpdatedAt,
    goalUpdatedAt: body.goalUpdatedAt,
    tz: body.tz,
  });
}

function mergeNumericMaps(
  a: Record<string, number> = {},
  b: Record<string, number> = {},
): Record<string, number> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}

function mergeHomeworkDone(
  a: Record<string, string[]> = {},
  b: Record<string, string[]> = {},
): Record<string, string[]> {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = Array.from(new Set([...(out[k] ?? []), ...v]));
  }
  return out;
}

function mergeJournal(prev: unknown[] = [], incoming: unknown[] = []): unknown[] {
  const byId = new Map<string, unknown>();
  for (const entry of prev) {
    const id = (entry as { id?: string })?.id;
    if (id) byId.set(id, entry);
  }
  for (const entry of incoming) {
    const id = (entry as { id?: string })?.id;
    if (id) byId.set(id, entry);
  }
  return [...byId.values()].slice(0, 100);
}

function mergeRecentGames(prev: unknown[] = [], incoming: unknown[] = []): unknown[] {
  const combined = [...incoming, ...prev];
  const seen = new Set<string>();
  const out: unknown[] = [];
  for (const g of combined) {
    const key = JSON.stringify(g);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(g);
    if (out.length >= 50) break;
  }
  return out;
}

/** Merge JSON blob fields that are not fully covered by mergeProgressSnapshots. */
export function mergeExtraData(
  prev: ExtraProgressData,
  incoming: ExtraProgressData,
): ExtraProgressData {
  const hasIncoming = (k: keyof ExtraProgressData) => incoming[k] !== undefined;
  const merged: ExtraProgressData = {
    rating: Math.max(prev.rating ?? 800, incoming.rating ?? prev.rating ?? 800),
    botWins: Math.max(prev.botWins ?? 0, incoming.botWins ?? prev.botWins ?? 0),
    dailyGoalXp: Math.max(
      Number(prev.dailyGoalXp ?? 50),
      Number(incoming.dailyGoalXp ?? prev.dailyGoalXp ?? 50),
    ),
    unlockedAchievements: hasIncoming("unlockedAchievements")
      ? Array.from(
          new Set([
            ...(prev.unlockedAchievements ?? []),
            ...(incoming.unlockedAchievements ?? []),
          ]),
        )
      : prev.unlockedAchievements,
    schoolExamsPassed: hasIncoming("schoolExamsPassed")
      ? Array.from(
          new Set([
            ...(prev.schoolExamsPassed ?? []),
            ...(incoming.schoolExamsPassed ?? []),
          ]),
        )
      : prev.schoolExamsPassed,
    weaknesses: mergeNumericMaps(prev.weaknesses, incoming.weaknesses),
    activityDays: mergeNumericMaps(prev.activityDays, incoming.activityDays),
    mistakeLog: hasIncoming("mistakeLog")
      ? (incoming.mistakeLog ?? prev.mistakeLog)
      : prev.mistakeLog,
    // Placeholder. `mergeProgressPush` replaces both from the day sequence.
    homeworkStreak: prev.homeworkStreak,
    homeworkLastDay: prev.homeworkLastDay,
    recentGames: hasIncoming("recentGames")
      ? mergeRecentGames(prev.recentGames, incoming.recentGames)
      : prev.recentGames,
    dailyPuzzleDay: hasIncoming("dailyPuzzleDay")
      ? newerCalendarDay(incoming.dailyPuzzleDay, prev.dailyPuzzleDay)
      : prev.dailyPuzzleDay,
    tz: canonicalStoredZone(incoming.tz, prev.tz),
    settings:
      incoming.settings !== undefined
        ? { ...(prev.settings ?? {}), ...incoming.settings }
        : prev.settings,
    homeworkDone: mergeHomeworkDone(prev.homeworkDone, incoming.homeworkDone),
    placementDone: Boolean(prev.placementDone || incoming.placementDone),
    journalEntries: hasIncoming("journalEntries")
      ? mergeJournal(prev.journalEntries, incoming.journalEntries)
      : prev.journalEntries,
  };
  // Client payloads are not a source for this key. Omission must not clear it.
  const storedGrace = readStoredStreakGrace(prev.streakGrace);
  if (storedGrace) merged.streakGrace = storedGrace;
  return merged;
}

function extraFromPush(body: ProgressPushBody): ExtraProgressData {
  // streakGrace is server-owned and is not read from the client body.
  return {
    rating: body.rating,
    botWins: body.botWins,
    dailyGoalXp: body.dailyGoalXp,
    unlockedAchievements: body.unlockedAchievements,
    schoolExamsPassed: body.schoolExamsPassed,
    weaknesses: body.weaknesses,
    activityDays: body.activityDays,
    mistakeLog: body.mistakeLog,
    homeworkStreak: body.homeworkStreak,
    homeworkLastDay: body.homeworkLastDay,
    recentGames: body.recentGames,
    dailyPuzzleDay: body.dailyPuzzleDay,
    settings: body.settings,
    homeworkDone: body.homeworkDone,
    placementDone: body.placementDone,
    journalEntries: body.journalEntries,
    ratingUpdatedAt: body.ratingUpdatedAt,
    goalUpdatedAt: body.goalUpdatedAt,
    tz: body.tz,
  };
}

/**
 * Homework streak from the stored day and the incoming day. The client count
 * is ignored. A day outside the server UTC day ±1 is rejected, and an earlier
 * day does not move the stored day backwards.
 */
export function nextHomeworkStreak(input: {
  storedStreak: number;
  storedDay: string | null;
  incomingDay: string | null | undefined;
  utcToday: string;
}): { streak: number; day: string | null } {
  const storedDay =
    input.storedDay && isCalendarDay(input.storedDay) ? input.storedDay : null;
  const storedStreak = Number.isFinite(input.storedStreak)
    ? Math.max(0, Math.floor(input.storedStreak))
    : 0;
  const claimed = homeworkDayWithinServerSkew(input.incomingDay, input.utcToday);
  if (!claimed) return { streak: storedStreak, day: storedDay };
  if (!storedDay) return { streak: 1, day: claimed };
  if (claimed <= storedDay) return { streak: storedStreak, day: storedDay };
  if (claimed === addDays(storedDay, 1)) {
    return { streak: storedStreak + 1, day: claimed };
  }
  return { streak: 1, day: claimed };
}

/** Real calendar day inside the server UTC day ±1. Further ahead is rejected. */
function homeworkDayWithinServerSkew(
  day: string | null | undefined,
  utcToday: string,
): string | null {
  if (!day || !isCalendarDay(day) || !isCalendarDay(utcToday)) return null;
  if (day < addDays(utcToday, -1) || day > addDays(utcToday, 1)) return null;
  return day;
}

function canonicalStoredZone(
  incoming: unknown,
  prev: string | undefined,
): string | undefined {
  if (typeof incoming === "string") {
    const canonical = canonicalTimeZone(incoming);
    if (canonical) return canonical;
  }
  return prev;
}

export type MergeProgressOptions = {
  /**
   * Server UTC day (`YYYY-MM-DD`) for the grace window and the active-day
   * set. Defaults to today's UTC date. Tests pass this so results ignore the clock.
   * The same instant is handed to `mergeProgressSnapshots` for its day cap.
   */
  today?: string;
  /**
   * Window start override for tests. Production omits this and reads
   * `STREAK_GRACE_START`. Unset or invalid disables grace.
   */
  graceStart?: string;
};

/**
 * Max-merge an incoming client snapshot over server state.
 * Incoming is treated as "local"; server as authoritative floor (H1/H2).
 *
 * `lastActiveDay` comes from `mergeProgressSnapshots`, which drops a client
 * day later than the server UTC day + 1. This merge does not apply a second
 * copy of that clamp.
 *
 * The client's streak number is never stored. The first push of any kind
 * seeds the set from `server.streak` only, anchored on the server's
 * `lastActiveDay`. A push that is not activity claims no day and grants no
 * grace. Activity may add the client's local day when that day is inside
 * the server UTC day ±1 and is not earlier than the newest stored day, and
 * may spend grace on one hole on or after the window start.
 *
 * Once the set exists, every push recomputes the streak from it by calling
 * `recomputeStreakFromActiveDays` on the server's stored active days. The
 * streak that is stored is the run those days support, at most 60. When there
 * is nothing to seed and no day to add, the stored streak stays the server's
 * number. `body.streak` and `body.homeworkStreak` are never stored. The object
 * written on the row is always the server's.
 *
 * POST /api/progress returns the merged streak, homework day, and writer
 * timestamps so another device can adopt them.
 */
export function mergeProgressPush(
  incoming: ProgressPushBody,
  server: ServerProgressState,
  options?: MergeProgressOptions,
): MergedProgressWrite {
  const utcToday = options?.today ?? serverUtcDay();
  const mergedCore = mergeProgressSnapshots(
    snapFromPush(incoming),
    snapFromServer(server),
    clockForServerDay(utcToday),
  );
  const mergedExtra = mergeExtraData(server.extra, extraFromPush(incoming));
  const played =
    isCalendarDay(utcToday) &&
    recordsStreakActivity(
      {
        xp: incoming.xp,
        botWins: incoming.botWins,
        lessons: incoming.lessons,
        dailyPuzzleDay: incoming.dailyPuzzleDay,
        recentGames: incoming.recentGames,
      },
      {
        xp: server.xp,
        botWins: server.extra.botWins,
        lessons: server.lessons,
        dailyPuzzleDay: server.extra.dailyPuzzleDay,
        recentGames: server.extra.recentGames,
      },
    );
  const parsed = parseStreakGrace(server.extra.streakGrace);
  const reconciled = isCalendarDay(utcToday)
    ? reconcileActiveStreak({
        hasActiveDays: parsed.hasActiveDays,
        activeDays: parsed.grace?.activeDays,
        graceUsedAt: parsed.grace?.graceUsedAt,
        graceCoveredDay: parsed.grace?.graceCoveredDay,
        storedLastActiveDay: server.lastActiveDay,
        // The client streak is never a seed, on a play push or any other.
        storedStreak: server.streak,
        today: utcToday,
        graceStart: options?.graceStart,
        claimedDay: played ? incoming.lastActiveDay : null,
        grantGrace: played,
      })
    : null;

  const data: ExtraProgressData = {
    ...mergedExtra,
    rating: mergedCore.rating,
    botWins: mergedCore.botWins,
    unlockedAchievements: mergedCore.unlockedAchievements as string[] | undefined,
    schoolExamsPassed: mergedCore.schoolExamsPassed as string[] | undefined,
    weaknesses: mergedCore.weaknesses as Record<string, number> | undefined,
    activityDays: mergedCore.activityDays as Record<string, number> | undefined,
    mistakeLog: mergedCore.mistakeLog,
    dailyPuzzleDay: mergedCore.dailyPuzzleDay as string | null | undefined,
    placementDone: Boolean(mergedCore.placementDone ?? mergedExtra.placementDone),
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
  };
  if (typeof mergedCore.ratingUpdatedAt === "number") {
    data.ratingUpdatedAt = mergedCore.ratingUpdatedAt;
  } else delete data.ratingUpdatedAt;
  if (typeof mergedCore.goalUpdatedAt === "number") {
    data.goalUpdatedAt = mergedCore.goalUpdatedAt;
  } else delete data.goalUpdatedAt;
  if (reconciled) {
    data.streakGrace = reconciled.streakGrace;
  }
  const homework = nextHomeworkStreak({
    storedStreak: server.extra.homeworkStreak ?? 0,
    storedDay: server.extra.homeworkLastDay ?? null,
    incomingDay: incoming.homeworkLastDay,
    utcToday,
  });
  data.homeworkStreak = homework.streak;
  data.homeworkLastDay = homework.day;

  // No set to seed and no day to add: keep the server number. Never `body.streak`.
  const streak = reconciled ? reconciled.streak : server.streak;

  return {
    xp: mergedCore.xp ?? 0,
    streak,
    lastActiveDay: mergedCore.lastActiveDay ?? null,
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
    graduatedClasses: (mergedCore.graduatedClasses as string[] | undefined) ?? [],
    data,
    lessons: (mergedCore.lessons ?? {}) as Record<string, LessonRec>,
  };
}

/** Merged fields POST /api/progress returns so another device can adopt them. */
export function progressPushResponseBody(
  lessonCount: number,
  merged: MergedProgressWrite,
  extra?: { dayRejected?: boolean },
): {
  ok: true;
  count: number;
  streak: number;
  lastActiveDay: string | null;
  rating: number;
  ratingUpdatedAt: number | null;
  dailyGoalXp: number;
  goalUpdatedAt: number | null;
  homeworkStreak: number;
  homeworkLastDay: string | null;
  dayRejected?: true;
} {
  return {
    ok: true,
    count: lessonCount,
    streak: merged.streak,
    lastActiveDay: merged.lastActiveDay,
    rating: merged.data.rating ?? 800,
    ratingUpdatedAt:
      typeof merged.data.ratingUpdatedAt === "number"
        ? merged.data.ratingUpdatedAt
        : null,
    dailyGoalXp: merged.dailyGoalXp,
    goalUpdatedAt:
      typeof merged.data.goalUpdatedAt === "number" ? merged.data.goalUpdatedAt : null,
    homeworkStreak: merged.data.homeworkStreak ?? 0,
    homeworkLastDay:
      typeof merged.data.homeworkLastDay === "string"
        ? merged.data.homeworkLastDay
        : null,
    ...(extra?.dayRejected ? { dayRejected: true as const } : {}),
  };
}
