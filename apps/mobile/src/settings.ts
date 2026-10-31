import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { normalizePieceThemeId, normalizeBoardThemeId } from "@chess-school/progression";
import { type PieceThemeId } from "./pieceThemes";
import { normalizeCoachVoice } from "./coachVoices";
import {
  DEFAULT_COACH_CHARACTER,
  normalizeCoachCharacter,
  type CoachCharacterId,
} from "./coachCharacters";
import { DEFAULT_UI_KIT, type UiKit } from "./uiKit";
import { NOTIFICATION_DEFAULTS } from "./notificationDefaults";
import { normalizeThemeMode, type ThemeMode } from "./themeMode";

export type { UiKit } from "./uiKit";
export type { ThemeMode } from "./themeMode";

export type BoardTheme =
  | "classic"
  | "chalkboard"
  | "marble"
  | "tournament"
  | "wooden"
  | "neon"
  | "paper"
  | "midnight"
  | "green" // legacy alias → tournament
  | "wood" // legacy alias → wooden
  | "violet" // legacy — web migrated names
  | "slate"
  | "forest";
export type Settings = {
  /** Premium illustrated dex kit (default) vs legacy mobile chrome. */
  uiKit: UiKit;
  haptics: boolean;
  sound: boolean;
  volume: number;
  reducedMotion: boolean;
  highContrast: boolean;
  colorblind: boolean;
  hints: boolean;
  targetElo: number;
  planTier: "casual" | "standard" | "serious" | "competitive" | "custom";
  customGoalXp: number;
  schedule: "daily" | "weekdays" | "weekends";
  avatar: string;
  coachPersonality: CoachCharacterId;
  coachCharacter: CoachCharacterId;
  coachSpeech: boolean;
  coachVoice: string;
  goal: string;
  boardTheme: BoardTheme;
  pieceTheme: PieceThemeId;
  appTheme: string;
  /** Premium dex: system / forced light / forced dark appearance. */
  themeMode: ThemeMode;
  schoolTheme: string;
  enrollPromptDismissedAt: number | null;
  diagnostics: boolean;
  textScale: number;
  /**
   * Opt-in analytics and performance sharing: one switch. Off until the user turns it on.
   * Only trusted at the current settingsVersion (see below).
   */
  shareAnalytics: boolean;
  /**
   * Version of the privacy settings, stored locally and on the account. Everyone was reset to off
   * once at SETTINGS_VERSION 1: a saved or account shareAnalytics below it is ignored, so an old
   * "on" can not come back through storage or a sync. An opt-in made at this version stays.
   */
  settingsVersion: number;
  notificationsEnabled: boolean;
  notificationHour: number;
  notificationMinute: number;
};

export const SETTINGS_VERSION = 1;
const versionOf = (s: { settingsVersion?: unknown } | null | undefined): number => {
  const v = Number(s?.settingsVersion);
  return Number.isFinite(v) ? v : 0;
};

const KEY = "chessschool.settings";
const isWeb = Platform.OS === "web";
// Frozen: reset() and the initial state copy it; nothing may change the defaults themselves.
const DEFAULTS: Readonly<Settings> = Object.freeze({
  uiKit: DEFAULT_UI_KIT,
  haptics: true,
  sound: true,
  volume: 1,
  reducedMotion: false,
  highContrast: false,
  colorblind: false,
  hints: true,
  targetElo: 600,
  planTier: "standard",
  customGoalXp: 60,
  schedule: "daily",
  avatar: "ava-knight",
  coachPersonality: DEFAULT_COACH_CHARACTER,
  coachCharacter: DEFAULT_COACH_CHARACTER,
  coachSpeech: true,
  coachVoice: "auto",
  goal: "",
  boardTheme: "classic",
  pieceTheme: "classic",
  appTheme: "default",
  themeMode: "system",
  schoolTheme: "university",
  enrollPromptDismissedAt: null,
  diagnostics: false,
  textScale: 1,
  // Opt-in: nothing is sent until the user turns this on. Also what the app sees until the saved
  // settings have loaded from storage.
  shareAnalytics: false,
  settingsVersion: SETTINGS_VERSION,
  ...NOTIFICATION_DEFAULTS,
});
let state: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

function normalizeSettings(next: Partial<Settings>): Partial<Settings> {
  const pieceTheme = (next as { pieceTheme?: string }).pieceTheme;
  const boardTheme = (next as { boardTheme?: string }).boardTheme;
  const schoolTheme = (next as { schoolTheme?: string }).schoolTheme;
  const character = normalizeCoachCharacter(
    next.coachCharacter ?? next.coachPersonality ?? DEFAULT_COACH_CHARACTER,
  );
  return {
    ...next,
    boardTheme: boardTheme !== undefined ? (normalizeBoardThemeId(boardTheme) as BoardTheme) : next.boardTheme,
    pieceTheme: pieceTheme !== undefined ? (normalizePieceThemeId(pieceTheme) as PieceThemeId) : next.pieceTheme,
    coachVoice: next.coachVoice !== undefined ? normalizeCoachVoice(next.coachVoice) : next.coachVoice,
    coachCharacter: character,
    coachPersonality: character,
    schoolTheme: schoolTheme && ["elementary", "highschool", "university", "graduation"].includes(schoolTheme)
      ? schoolTheme
      : next.schoolTheme ?? "university",
    // A saved or account copy that never stored the flag is not an opt-in: an explicit false, not
    // undefined (which would leave whatever the state had).
    shareAnalytics: next.shareAnalytics === undefined ? false : Boolean(next.shareAnalytics),
    uiKit:
      next.uiKit === "classic" || next.uiKit === "premium"
        ? next.uiKit
        : next.uiKit === undefined
          ? undefined
          : "premium",
    themeMode: next.themeMode !== undefined ? normalizeThemeMode(next.themeMode) : next.themeMode,
  } as Partial<Settings>;
}

function emit() {
  for (const l of listeners) l();
}
function persist() {
  const raw = JSON.stringify(state);
  if (isWeb) {
    try {
      localStorage.setItem(KEY, raw);
    } catch {
      /* ignore */
    }
  } else {
    SecureStore.setItemAsync(KEY, raw).catch(() => void 0);
  }
}

// Declared before the startup load below, which can call pushToAccount() before this line would run.
let pushTimer: ReturnType<typeof setTimeout> | null = null;

// Load persisted settings on startup.
(async () => {
  try {
    const raw = isWeb ? (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) : await SecureStore.getItemAsync(KEY);
    if (raw) {
      const saved = JSON.parse(raw);
      const stale = versionOf(saved) < SETTINGS_VERSION;
      // The one-time reset: a copy saved before the settings version (an old "on") comes back off,
      // stamped with the version, so this runs once.
      state = {
        ...state,
        ...normalizeSettings(saved),
        ...(stale ? { shareAnalytics: false, settingsVersion: SETTINGS_VERSION } : {}),
      };
      if (stale) {
        persist();
        void pushToAccount(); // so the account copy carries the version too (no-op when logged out)
      }
      emit();
    }
  } catch {
    /* ignore */
  }
})();

// --- Per-user account sync (so settings follow the user across web + app) ---
async function pushToAccount() {
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(async () => {
    try {
      const { mutateProgress } = await import("./progressStore");
      await mutateProgress((snap) => ({ ...snap, settings: state }));
    } catch {
      /* ignore (offline / logged out) */
    }
  }, 700);
}

/** Apply settings stored on the account (called on login). Does not re-sync. */
export function hydrateSettings(remote: Partial<Settings> | null | undefined) {
  if (!remote || typeof remote !== "object") return;
  const incoming = normalizeSettings(remote);
  if (versionOf(remote) < SETTINGS_VERSION) {
    // An account copy from before the reset: its shareAnalytics (an old "on") does not count, and
    // this device keeps its own choice. Everything else still syncs.
    delete incoming.shareAnalytics;
    delete incoming.settingsVersion;
  } else {
    incoming.settingsVersion = Math.max(versionOf(remote), SETTINGS_VERSION);
  }
  state = { ...state, ...incoming };
  persist();
  emit();
}
/** Pull settings from the account and apply them. */
export async function loadSettingsFromAccount() {
  try {
    const { api } = await import("./api");
    const p = await api<{ settings?: Partial<Settings> | null }>("/api/progress");
    hydrateSettings(p.settings);
  } catch {
    /* ignore */
  }
}

export const settings = {
  get: () => state,
  /**
   * The wipe path (logout, a 401, delete: wipeUserData). Analytics is off after it. DEFAULTS has
   * it off too (opt-in), and the explicit override keeps the wipe safe if that default ever flips.
   */
  reset: () => {
    state = { ...DEFAULTS, shareAnalytics: false };
    persist();
    emit();
  },
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => {
    const patch = { [key]: value } as Partial<Settings>;
    if (key === "coachCharacter" || key === "coachPersonality") {
      const c = normalizeCoachCharacter(value);
      patch.coachCharacter = c;
      patch.coachPersonality = c;
    }
    state = { ...state, ...patch };
    persist();
    emit();
    void pushToAccount();
  },
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

export function useSettings(): Settings {
  return useSyncExternalStore(settings.subscribe, settings.get, settings.get);
}

/** Board square colors per theme — matched 1:1 to web (core/themes/themes.ts). */
export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string; move: string }> = {
  classic: { light: "#eef0f4", dark: "#7c8aa5", move: "#7be0b3" },
  chalkboard: { light: "#5b6b63", dark: "#2f3b38", move: "#9fe3c5" },
  marble: { light: "#f3efe9", dark: "#b9b2a7", move: "#9ad0c2" },
  tournament: { light: "#e9eef0", dark: "#6a9b78", move: "#f2c14e" },
  wooden: { light: "#e8cfa6", dark: "#a9743f", move: "#7fd1a8" },
  neon: { light: "#1f2238", dark: "#3a2f6b", move: "#41e0c8" },
  paper: { light: "#faf7f0", dark: "#cdbf9c", move: "#8fd0b0" },
  midnight: { light: "#3a3f5c", dark: "#1c2036", move: "#5aa9e6" },
  // legacy aliases so previously-saved settings still resolve
  green: { light: "#e9eef0", dark: "#6a9b78", move: "#f2c14e" },
  wood: { light: "#e8cfa6", dark: "#a9743f", move: "#7fd1a8" },
  violet: { light: "#ede7f6", dark: "#b9a8e6", move: "#7be0b3" },
  slate: { light: "#e8eef7", dark: "#9bb8d3", move: "#5aa9e6" },
  forest: { light: "#e9efe1", dark: "#a3c293", move: "#7fd1a8" },
};

/** Themes shown in the picker (excludes legacy aliases). */
export const SELECTABLE_BOARD_THEMES: BoardTheme[] = ["classic", "chalkboard", "marble", "tournament", "wooden", "neon", "paper", "midnight"];
export const BOARD_THEME_NAMES: Record<string, string> = {
  classic: "Classic", chalkboard: "Chalkboard", marble: "Marble", tournament: "Tournament", wooden: "Wooden", neon: "Neon", paper: "Paper", midnight: "Midnight",
};
