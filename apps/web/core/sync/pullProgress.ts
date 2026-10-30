import {
  useProgression,
  progressGeneration,
  progressSnapshot,
  type ProgressSnapshot,
} from "@/core/store/progression.store";
import { usePlan } from "@/core/store/plan.store";
import { useSession } from "@/core/store/session.store";
import { clearRuntimeCaches } from "@/core/pwa/clearRuntimeCaches";
import {
  GUEST_OWNER_UNKNOWN,
  clearGuestOwner,
  clearSignedInMarker,
  getSignedInMarker,
  markSignedIn,
  getGuestOwner,
  setGuestOwner,
} from "@/core/sync/guestOwner";
import { useSettings, type SettingsState } from "@/core/store/settings.store";
import {
  listJournal,
  replaceJournalEntries,
  replaceGamesFromSync,
  reconcileLocalRows,
  listGames,
  type JournalEntry,
} from "@/core/db/db";
import { legacyOwner, withoutOwner } from "@/core/sync/rowOwner";
import {
  accountProgressEmpty,
  capActivityDays,
  capWeaknesses,
  deviceTimeZone,
  localProgressPresent,
  normalizeSyncGame,
} from "@chess-school/progression";
import {
  normalizeBoardThemeId,
  normalizePieceThemeId,
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
  "coachCharacter",
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
  user: { id: string; email: string; name: string; role: string };
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
    // The server caps these maps. Cut here too, so a push never earns a 400.
    activityDays: capActivityDays(p.activityDays),
    weaknesses: capWeaknesses(p.weaknesses),
    homeworkStreak: plan.homeworkStreak,
    homeworkLastDay: plan.homeworkLastDay,
    tz: deviceTimeZone(),
    settings: settingsPayload,
  };
}

/** Async push payload including Dexie journal entries + saved games. */
export async function fullSnapshotAsync() {
  const base = fullSnapshot();
  try {
    const [journal, games] = await Promise.all([listJournal(), listGames()]);
    // Rows are already the signed-in user's only (db.ts); the owner tag never leaves the device.
    const journalEntries = journal.map((e) => withoutOwner(e));
    const recentGames = games
      .map((g) => normalizeSyncGame(withoutOwner(g)))
      .filter((g): g is NonNullable<typeof g> => g !== null);
    return { ...base, journalEntries, recentGames };
  } catch {
    return base;
  }
}

/** Forget the progress left in the persisted stores: another user's, or a copy not for this user. */
function wipePersistedStore(): void {
  useProgression.getState().reset();
  usePlan.setState({
    routineDay: null,
    routineDone: [],
    homeworkStreak: 0,
    homeworkLastDay: null,
  });
}

/**
 * The server says the session is gone (a 401 on the pull or on a push): the same as a
 * logout for cache purposes, but the edits stay as guest progress tagged with their owner
 * (DP-W-002: a 401 on a push used to do nothing, so the next sign-in found the store as if
 * it were its own).
 */
export function handleSessionExpired(): void {
  const session = useSession.getState();
  // The session store says signed in, or (a cold start, where the persisted session is
  // missing or says signed out) the signed-in marker of the last successful pull does.
  const marker = getSignedInMarker();
  if (session.authed === true || marker !== null) {
    // The edit stays as guest progress: remember whose it is. When the user is not
    // known the tag matches nobody, so the copy is never merged. No marker and not
    // signed in: a real guest, left untagged, it merges as before.
    const known = session.authed === true ? session.user?.id : undefined;
    setGuestOwner(known ?? marker ?? GUEST_OWNER_UNKNOWN);
    clearSignedInMarker();
    void clearRuntimeCaches();
  }
  if (session.authed !== false) useSession.getState().setSession(false, null);
}

/**
 * Pull the account's progress and apply it. The account is the source of truth:
 * an established account REPLACES local state (hydrate); a brand-new account that
 * a guest just created instead absorbs the guest's local progress (merge-up).
 * Returns the user, or null if not logged in.
 */
export async function pullProgress(): Promise<{
  id: string;
  email: string;
  name: string;
  role: string;
} | null> {
  let generation = progressGeneration();
  let r: Response;
  try {
    r = await fetch("/api/progress");
  } catch {
    return null;
  }
  if (!r.ok) {
    // Drain the unused body: for a Cache-Control: no-store response Chrome keeps the
    // request pending until it is consumed, which stalls `networkidle`.
    void r.body?.cancel().catch(() => undefined);
  }
  if (r.status === 401) {
    handleSessionExpired();
    return null;
  }
  if (!r.ok) return null;
  const data = (await r.json()) as ServerSnapshot;
  // Logged out (store reset) while the GET was in flight: the reply is the old user's.
  if (generation !== progressGeneration()) return null;

  // Guest progress kept after a session expiry belongs to that user. A different user
  // signing in does not get it (same wipe as a logout); the same user keeps it.
  // Who the untagged local rows belong to: read before the markers below are rewritten.
  const legacy = legacyOwner();
  const owner = getGuestOwner();
  if (owner !== null) {
    clearGuestOwner();
    if (owner !== data.user.id) {
      wipePersistedStore();
      generation = progressGeneration();
    }
  }
  // The last successful pull was for another user, and nothing signed them out here
  // (no logout, no 401 that tagged the copy): this device still holds that user's store.
  // It must not reach this user, by a merge into a new account or by what hydrate leaves
  // alone. No marker is a real guest, whose progress merges as before; the same user's
  // marker is a plain refresh.
  const lastSignedIn = getSignedInMarker();
  if (lastSignedIn !== null && lastSignedIn !== data.user.id) {
    wipePersistedStore();
    generation = progressGeneration();
  }

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
        let val = data.settings[key];
        if (key === "boardTheme" && typeof val === "string")
          val = normalizeBoardThemeId(val);
        if (key === "pieceTheme" && typeof val === "string")
          val = normalizePieceThemeId(val);
        (patch as Record<string, unknown>)[key] = val;
      }
    }
    useSettings.getState().applyPatch(patch);
  }
  // Local journal / games / reviews: keep this user's (and a guest's, for a new account),
  // drop everyone else's. Without this, A's journal stayed when B's own list was empty
  // and went out with B's next push.
  try {
    await reconcileLocalRows(data.user.id, accountEmpty, legacy);
  } catch {
    /* rows stay owner-tagged: reads and pushes still filter them */
  }
  if (generation !== progressGeneration()) return null;
  if (Array.isArray(data.journalEntries) && data.journalEntries.length > 0) {
    try {
      await replaceJournalEntries(data.journalEntries, data.user.id);
    } catch {
      /* ignore */
    }
  }
  // Logged out during the journal write: do not write the old user's games or session.
  if (generation !== progressGeneration()) return null;
  if (Array.isArray(data.recentGames)) {
    try {
      await replaceGamesFromSync(data.recentGames, data.user.id);
    } catch {
      /* ignore */
    }
  }
  if (generation !== progressGeneration()) return null;
  markSignedIn(data.user.id);
  const session = useSession.getState();
  if (
    session.authed !== true ||
    session.user?.id !== data.user.id ||
    session.user?.email !== data.user.email ||
    session.user?.name !== data.user.name ||
    session.user?.role !== data.user.role
  ) {
    useSession.getState().setSession(true, data.user);
  }
  return data.user;
}
