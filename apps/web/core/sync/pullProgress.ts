import {
  useProgression,
  progressSnapshot,
  type ProgressSnapshot,
} from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { listJournal, replaceJournalEntries, replaceGamesFromSync, listGames, type JournalEntry } from "@/core/db/db";
import { normalizeSyncGame } from "@chess-school/progression";

export type ServerSnapshot = ProgressSnapshot & {
  user: { name: string; role: string };
  homeworkStreak?: number;
  homeworkLastDay?: string | null;
  settings?: Record<string, unknown> | null;
  journalEntries?: JournalEntry[];
  placementDone?: boolean;
  homeworkDone?: Record<string, string[]>;
  recentGames?: unknown[];
  dailyPuzzleDay?: string | null;
};

/** The full push payload — progression snapshot + homework streak + settings + journal. */
export function fullSnapshot() {
  const p = progressSnapshot(useProgression.getState());
  const plan = usePlan.getState();
  const s = useSettings.getState();
  const { set, toggle, reset, ...settingsPayload } = s;
  return {
    ...p,
    homeworkStreak: plan.homeworkStreak,
    homeworkLastDay: plan.homeworkLastDay,
    settings: settingsPayload,
  };
}

/** Async push payload including Dexie journal entries + saved games. */
export async function fullSnapshotAsync() {
  const base = fullSnapshot();
  try {
    const [journalEntries, games] = await Promise.all([listJournal(), listGames()]);
    const recentGames = games.map((g) => normalizeSyncGame(g)).filter((g): g is NonNullable<typeof g> => g !== null);
    return { ...base, journalEntries, recentGames };
  } catch {
    return base;
  }
}

/**
 * Pull the account's progress and apply it. The account is the source of truth:
 * an established account REPLACES local state (hydrate); a brand-new account that
 * a guest just created instead absorbs the guest's local progress (merge-up).
 * Returns the user, or null if not logged in.
 */
export async function pullProgress(): Promise<{ name: string; role: string } | null> {
  let r: Response;
  try {
    r = await fetch("/api/progress");
  } catch {
    return null;
  }
  if (r.status === 401) {
    useSession.getState().setSession(false, null);
    return null;
  }
  if (!r.ok) return null;
  const data = (await r.json()) as ServerSnapshot;

  const local = progressSnapshot(useProgression.getState());
  const guestHadProgress = local.xp > 0 || Object.keys(local.lessons).length > 0;
  const accountEmpty = data.xp === 0 && Object.keys(data.lessons ?? {}).length === 0;

  if (accountEmpty && guestHadProgress) {
    useProgression.getState().mergeSnapshot(data); // guest → new account: carry progress up
  } else {
    useProgression.getState().hydrateSnapshot(data); // established account is authoritative
  }
  if (data.dailyPuzzleDay !== undefined) {
    useProgression.setState({ dailyPuzzleDay: data.dailyPuzzleDay ?? null });
  }
  usePlan.getState().setHomework(data.homeworkStreak ?? 0, data.homeworkLastDay ?? null);
  if (data.settings && typeof data.settings === "object") {
    useSettings.getState().set("sound", Boolean(data.settings.sound ?? true));
    for (const key of ["volume", "haptics", "reducedMotion", "hints", "highContrast", "boardTheme", "schoolTheme", "appTheme", "pieceTheme", "coachPersonality", "targetElo", "textScale", "colorblind"] as const) {
      if (key in data.settings && data.settings[key] !== undefined) {
        useSettings.getState().set(key, data.settings[key] as never);
      }
    }
  }
  if (Array.isArray(data.journalEntries) && data.journalEntries.length > 0) {
    try {
      await replaceJournalEntries(data.journalEntries);
    } catch {
      /* ignore */
    }
  }
  if (Array.isArray(data.recentGames)) {
    try {
      await replaceGamesFromSync(data.recentGames);
    } catch {
      /* ignore */
    }
  }
  useSession.getState().setSession(true, data.user);
  return data.user;
}
