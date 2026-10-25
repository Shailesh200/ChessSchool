import {
  mergeProgressSnapshots,
  normalizeProgressPush,
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
    dailyGoalXp: state.dailyGoalXp,
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
    homeworkStreak: Math.max(
      prev.homeworkStreak ?? 0,
      incoming.homeworkStreak ?? prev.homeworkStreak ?? 0,
    ),
    homeworkLastDay: incoming.homeworkLastDay ?? prev.homeworkLastDay ?? null,
    recentGames: hasIncoming("recentGames")
      ? mergeRecentGames(prev.recentGames, incoming.recentGames)
      : prev.recentGames,
    dailyPuzzleDay: incoming.dailyPuzzleDay ?? prev.dailyPuzzleDay ?? null,
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

/**
 * Max-merge an incoming client snapshot over server state.
 * Incoming is treated as "local"; server as authoritative floor (H1/H2).
 *
 * Streak grace runs after that merge. `mergedStreak` is whatever
 * `mergeProgressSnapshots` chose — max() today, the newer `lastActiveDay`'s
 * streak after D3. Grace replaces it only for the one-time one-day rule, and
 * the flag written into `data.streakGrace` always comes from the server.
 * An incoming `lastActiveDay` later than the server UTC day + 1 is not
 * stored, and that push does not change the streak.
 *
 * The corrected streak is what gets stored. POST /api/progress still replies
 * `{ ok, count }` only, and neither web ProgressSync nor mobile mutateProgress
 * copies a merged streak out of that response. Clients pick it up on the next GET.
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
  const mergedCore = mergeProgressSnapshots(
    snapFromPush(incoming),
    snapFromServer(server),
  );
  const mergedExtra = mergeExtraData(server.extra, extraFromPush(incoming));
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
    unlockedAchievements: mergedCore.unlockedAchievements as string[] | undefined,
    schoolExamsPassed: mergedCore.schoolExamsPassed as string[] | undefined,
    weaknesses: mergedCore.weaknesses as Record<string, number> | undefined,
    activityDays: mergedCore.activityDays as Record<string, number> | undefined,
    mistakeLog: mergedCore.mistakeLog,
    dailyPuzzleDay: mergedCore.dailyPuzzleDay as string | null | undefined,
    placementDone: Boolean(mergedCore.placementDone ?? mergedExtra.placementDone),
  };
  if (graced.streakGrace) data.streakGrace = graced.streakGrace;
  else delete data.streakGrace;

  return {
    xp: mergedCore.xp ?? 0,
    streak: graced.streak,
    lastActiveDay: activity.lastActiveDay,
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
    graduatedClasses: (mergedCore.graduatedClasses as string[] | undefined) ?? [],
    data,
    lessons: (mergedCore.lessons ?? {}) as Record<string, LessonRec>,
  };
}
