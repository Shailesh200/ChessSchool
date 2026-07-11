import {
  useProgression,
  progressSnapshot,
  type ProgressSnapshot,
} from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { useSettings, type SettingsState } from "@/core/store/settings.store";
import {
  listJournal,
  replaceJournalEntries,
  replaceGamesFromSync,
  listGames,
  type JournalEntry,
} from "@/core/db/db";
import {
  accountProgressEmpty,
  localProgressPresent,
  normalizeSyncGame,
} from "@chess-school/progression";

const SYNCED_SETTING_KEYS = [
  "sound",
  "volume",
  "haptics",
  "reducedMotion",
  "hints",
  "highContrast",
  "boardTheme",
  "schoolTheme",
  "appTheme",
  "pieceTheme",
  "coachPersonality",
  "coachSpeech",
  "coachVoice",
  "targetElo",
  "textScale",
  "colorblind",
] as const;

function snapshotsEqual(
  a: ProgressSnapshot,
  b: ProgressSnapshot & { placementDone?: boolean },
  placementDone: boolean,
): boolean {
  return (
    a.xp === b.xp &&
    a.streak === b.streak &&
    a.rating === (b.rating ?? 800) &&
    a.lastActiveDay === b.lastActiveDay &&
    a.dailyGoalXp === (b.dailyGoalXp ?? 50) &&
    placementDone === Boolean(b.placementDone) &&
    JSON.stringify(a.graduatedClasses) === JSON.stringify(b.graduatedClasses ?? []) &&
    JSON.stringify(a.lessons) === JSON.stringify(b.lessons ?? {})
  );
}

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
    const recentGames = games
      .map((g) => normalizeSyncGame(g))
      .filter((g): g is NonNullable<typeof g> => g !== null);
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
    const session = useSession.getState();
    if (session.authed !== false) useSession.getState().setSession(false, null);
    return null;
  }
  if (!r.ok) return null;
  const data = (await r.json()) as ServerSnapshot;

  const localSnap = progressSnapshot(useProgression.getState());
  const guestHadProgress = localProgressPresent({
    ...localSnap,
    placementDone: useProgression.getState().placementDone,
  });
  const accountEmpty = accountProgressEmpty({
    ...data,
    placementDone: data.placementDone,
  });

  if (accountEmpty && guestHadProgress) {
    useProgression
      .getState()
      .mergeSnapshot({ ...data, placementDone: data.placementDone });
  } else {
    const current = progressSnapshot(useProgression.getState());
    const incoming = { ...data, placementDone: data.placementDone };
    if (!snapshotsEqual(current, incoming, Boolean(data.placementDone))) {
      useProgression.getState().hydrateSnapshot(incoming);
    }
  }
  if (
    data.dailyPuzzleDay !== undefined &&
    data.dailyPuzzleDay !== useProgression.getState().dailyPuzzleDay
  ) {
    useProgression.setState({ dailyPuzzleDay: data.dailyPuzzleDay ?? null });
  }
  usePlan
    .getState()
    .setHomework(data.homeworkStreak ?? 0, data.homeworkLastDay ?? null);
  if (data.settings && typeof data.settings === "object") {
    type SyncedSettings = Partial<
      Omit<SettingsState, "set" | "toggle" | "reset" | "applyPatch" | "diagnostics">
    >;
    const patch: SyncedSettings = {
      sound: Boolean(data.settings.sound ?? true),
    };
    for (const key of SYNCED_SETTING_KEYS) {
      if (key === "sound") continue;
      if (key in data.settings && data.settings[key] !== undefined) {
        (patch as Record<string, unknown>)[key] = data.settings[key];
      }
    }
    useSettings.getState().applyPatch(patch);
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
  const session = useSession.getState();
  if (
    session.authed !== true ||
    session.user?.name !== data.user.name ||
    session.user?.role !== data.user.role
  ) {
    useSession.getState().setSession(true, data.user);
  }
  return data.user;
}
