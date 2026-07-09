import {
  mergeProgressSnapshots,
  normalizeProgressPush,
  type Snap,
} from "@chess-school/progression";
import type { ProgressPushBody } from "@/lib/api-schemas";

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
  return {
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
}

function extraFromPush(body: ProgressPushBody): ExtraProgressData {
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

/**
 * Max-merge an incoming client snapshot over server state.
 * Incoming is treated as "local"; server as authoritative floor (H1/H2).
 */
export function mergeProgressPush(
  incoming: ProgressPushBody,
  server: ServerProgressState,
): MergedProgressWrite {
  const mergedCore = mergeProgressSnapshots(
    snapFromPush(incoming),
    snapFromServer(server),
  );
  const mergedExtra = mergeExtraData(server.extra, extraFromPush(incoming));

  return {
    xp: mergedCore.xp ?? 0,
    streak: mergedCore.streak ?? 0,
    lastActiveDay: mergedCore.lastActiveDay ?? null,
    dailyGoalXp: Number(mergedCore.dailyGoalXp ?? server.dailyGoalXp ?? 50),
    graduatedClasses: (mergedCore.graduatedClasses as string[] | undefined) ?? [],
    data: {
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
    },
    lessons: (mergedCore.lessons ?? {}) as Record<string, LessonRec>,
  };
}
