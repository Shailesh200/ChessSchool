import {
  mergeMistakeLog,
  mergeProgressSnapshots,
  newerIsoDay,
  normalizeProgressPush,
  pickLastWriterNumber,
  pickStreakByRecency,
  type ActiveDayPolicy,
  type Snap,
} from "@chess-school/progression";
import type { ProgressPushBody } from "@/lib/api-schemas";
import {
  applyOneTimeStreakGrace,
  mergeActivityDay,
  readStoredStreakGrace,
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
  /** Integer ms. Present only after a client that stamps rating writes. */
  ratingUpdatedAt?: number;
  /** Integer ms. Present only after a client that stamps the goal writes. */
  goalUpdatedAt?: number;
  /** Device IANA zone. Stored for a later server-side day. Not read yet. */
  tz?: string;
  /**
   * Server-owned one-time streak grace. Merge always keeps the stored value
   * and never copies a client-sent `streakGrace` (including when the client
   * omits the key). Only `applyOneTimeStreakGrace` writes it.
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
    ratingUpdatedAt: state.extra.ratingUpdatedAt,
    goalUpdatedAt: state.extra.goalUpdatedAt,
    recentGames: state.extra.recentGames,
    dailyPuzzleDay: state.extra.dailyPuzzleDay,
    homeworkDone: state.extra.homeworkDone,
    placementDone: state.extra.placementDone,
    journalEntries: state.extra.journalEntries,
    settings: state.extra.settings,
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
    ratingUpdatedAt: body.ratingUpdatedAt,
    goalUpdatedAt: body.goalUpdatedAt,
    recentGames: body.recentGames,
    dailyPuzzleDay: body.dailyPuzzleDay,
    homeworkDone: body.homeworkDone,
    placementDone: body.placementDone,
    journalEntries: body.journalEntries,
    settings: body.settings,
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
  policy?: ActiveDayPolicy,
): ExtraProgressData {
  const hasIncoming = (k: keyof ExtraProgressData) => incoming[k] !== undefined;
  const incomingRatingStamp =
    typeof incoming.ratingUpdatedAt === "number" &&
    Number.isInteger(incoming.ratingUpdatedAt);
  const incomingGoalStamp =
    typeof incoming.goalUpdatedAt === "number" &&
    Number.isInteger(incoming.goalUpdatedAt);
  // An omitted value with no timestamp must not default over the stored one.
  const rating = pickLastWriterNumber(
    incoming.rating ?? (incomingRatingStamp ? 800 : (prev.rating ?? 800)),
    incoming.ratingUpdatedAt,
    prev.rating ?? 800,
    prev.ratingUpdatedAt,
  );
  const goal = pickLastWriterNumber(
    Number(incoming.dailyGoalXp ?? (incomingGoalStamp ? 50 : (prev.dailyGoalXp ?? 50))),
    incoming.goalUpdatedAt,
    Number(prev.dailyGoalXp ?? 50),
    prev.goalUpdatedAt,
  );
  const homework = pickStreakByRecency(
    { streak: incoming.homeworkStreak ?? 0, day: incoming.homeworkLastDay },
    { streak: prev.homeworkStreak ?? 0, day: prev.homeworkLastDay },
    policy,
  );
  const merged: ExtraProgressData = {
    rating: rating.value,
    botWins: Math.max(prev.botWins ?? 0, incoming.botWins ?? prev.botWins ?? 0),
    dailyGoalXp: goal.value,
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
      ? mergeMistakeLog(incoming.mistakeLog, prev.mistakeLog)
      : prev.mistakeLog,
    homeworkStreak: homework.streak,
    homeworkLastDay: homework.day,
    recentGames: hasIncoming("recentGames")
      ? mergeRecentGames(prev.recentGames, incoming.recentGames)
      : prev.recentGames,
    dailyPuzzleDay: hasIncoming("dailyPuzzleDay")
      ? newerIsoDay(incoming.dailyPuzzleDay, prev.dailyPuzzleDay)
      : (prev.dailyPuzzleDay ?? null),
    settings:
      incoming.settings !== undefined
        ? { ...(prev.settings ?? {}), ...incoming.settings }
        : prev.settings,
    homeworkDone: mergeHomeworkDone(prev.homeworkDone, incoming.homeworkDone),
    placementDone: Boolean(prev.placementDone || incoming.placementDone),
    journalEntries: hasIncoming("journalEntries")
      ? mergeJournal(prev.journalEntries, incoming.journalEntries)
      : prev.journalEntries,
    tz: typeof incoming.tz === "string" && incoming.tz ? incoming.tz : prev.tz,
  };
  if (rating.at !== null) merged.ratingUpdatedAt = rating.at;
  if (goal.at !== null) merged.goalUpdatedAt = goal.at;
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
    ratingUpdatedAt: body.ratingUpdatedAt,
    goalUpdatedAt: body.goalUpdatedAt,
    tz: body.tz,
    recentGames: body.recentGames,
    dailyPuzzleDay: body.dailyPuzzleDay,
    settings: body.settings,
    homeworkDone: body.homeworkDone,
    placementDone: body.placementDone,
    journalEntries: body.journalEntries,
  };
}

export type MergeProgressOptions = {
  /**
   * Server UTC day (`YYYY-MM-DD`) for the grace window and the activity-day
   * cap. Defaults to today's UTC date. Tests pass this so results ignore the clock.
   */
  today?: string;
  /**
   * Window start override for tests. Production omits this and reads
   * `STREAK_GRACE_START`. Unset or invalid disables grace.
   */
  graceStart?: string;
};

/** Merged fields POST /api/progress returns so a client can adopt the server result. */
export function progressPushResponseBody(
  lessonCount: number,
  merged: MergedProgressWrite,
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
  };
}

/**
 * Recency-merge an incoming client snapshot over server state.
 * XP, bot wins, and lesson mastery stay monotonic. Streak, rating, and the
 * daily goal follow the rules in `mergeProgressSnapshots` and may go down.
 *
 * Streak grace runs after that merge. `mergedStreak` is the streak on the
 * side with the newer acceptable `lastActiveDay` (the larger streak wins a
 * same-day tie). Grace replaces it only for the one-time one-day rule, and
 * the flag written into `data.streakGrace` always comes from the server.
 * An incoming `lastActiveDay` later than the server UTC day + 1, or a
 * malformed day, is not stored, and that push does not change the streak.
 * POST /api/progress returns the merged streak, the winning homework day, and
 * the winning writer timestamps so another device can adopt them immediately.
 */
export function mergeProgressPush(
  incoming: ProgressPushBody,
  server: ServerProgressState,
  options?: MergeProgressOptions,
): MergedProgressWrite {
  const utcToday = options?.today ?? serverUtcDay();
  const activity = mergeActivityDay(
    incoming.lastActiveDay,
    server.lastActiveDay,
    utcToday,
  );
  const policy: ActiveDayPolicy = { today: utcToday };
  const mergedCore = mergeProgressSnapshots(
    snapFromPush(incoming),
    snapFromServer(server),
    policy,
  );
  const mergedExtra = mergeExtraData(server.extra, extraFromPush(incoming), policy);
  const graced = activity.rejectIncoming
    ? {
        streak: server.streak,
        streakGrace: readStoredStreakGrace(server.extra.streakGrace),
      }
    : applyOneTimeStreakGrace({
        storedStreak: server.streak,
        storedLastActiveDay: server.lastActiveDay,
        incomingStreak: incoming.streak,
        incomingLastActiveDay: incoming.lastActiveDay,
        mergedStreak: mergedCore.streak ?? 0,
        storedGrace: server.extra.streakGrace,
        today: utcToday,
        graceStart: options?.graceStart,
      });

  const data: ExtraProgressData = {
    ...mergedExtra,
    rating: mergedCore.rating,
    botWins: mergedCore.botWins,
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
    unlockedAchievements: mergedCore.unlockedAchievements as string[] | undefined,
    schoolExamsPassed: mergedCore.schoolExamsPassed as string[] | undefined,
    weaknesses: mergedCore.weaknesses as Record<string, number> | undefined,
    activityDays: mergedCore.activityDays as Record<string, number> | undefined,
    mistakeLog: mergedCore.mistakeLog,
    homeworkStreak:
      typeof mergedCore.homeworkStreak === "number" ? mergedCore.homeworkStreak : 0,
    homeworkLastDay:
      typeof mergedCore.homeworkLastDay === "string"
        ? mergedCore.homeworkLastDay
        : null,
    dailyPuzzleDay: mergedCore.dailyPuzzleDay as string | null | undefined,
    placementDone: Boolean(mergedCore.placementDone ?? mergedExtra.placementDone),
  };
  if (typeof mergedCore.ratingUpdatedAt === "number") {
    data.ratingUpdatedAt = mergedCore.ratingUpdatedAt;
  } else delete data.ratingUpdatedAt;
  if (typeof mergedCore.goalUpdatedAt === "number") {
    data.goalUpdatedAt = mergedCore.goalUpdatedAt;
  } else delete data.goalUpdatedAt;
  if (graced.streakGrace) data.streakGrace = graced.streakGrace;
  else delete data.streakGrace;

  return {
    xp: mergedCore.xp ?? 0,
    streak: graced.streak,
    lastActiveDay: activity.rejectIncoming
      ? activity.lastActiveDay
      : (mergedCore.lastActiveDay ?? activity.lastActiveDay),
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
    graduatedClasses: (mergedCore.graduatedClasses as string[] | undefined) ?? [],
    data,
    lessons: (mergedCore.lessons ?? {}) as Record<string, LessonRec>,
  };
}
