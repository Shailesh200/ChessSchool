import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { normalizePieceThemeId, normalizeBoardThemeId } from "@chess-school/progression";
import { type PieceThemeId } from "./pieceThemes";
import { normalizeCoachVoice } from "./coachVoices";

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
  coachPersonality: string;
  coachSpeech: boolean;
  coachVoice: string;
  goal: string;
  boardTheme: BoardTheme;
  pieceTheme: PieceThemeId;
  appTheme: string;
  schoolTheme: string;
  enrollPromptDismissedAt: number | null;
  diagnostics: boolean;
  textScale: number;
};

const KEY = "chessschool.settings";
const isWeb = Platform.OS === "web";
const DEFAULTS: Settings = {
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
  coachPersonality: "friendly",
  coachSpeech: true,
  coachVoice: "auto",
  goal: "",
  boardTheme: "classic",
  pieceTheme: "classic",
  appTheme: "default",
  schoolTheme: "university",
  enrollPromptDismissedAt: null,
  diagnostics: false,
  textScale: 1,
};
let state: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

function normalizeSettings(next: Partial<Settings>): Partial<Settings> {
  const pieceTheme = (next as { pieceTheme?: string }).pieceTheme;
  const boardTheme = (next as { boardTheme?: string }).boardTheme;
  const schoolTheme = (next as { schoolTheme?: string }).schoolTheme;
  return {
    ...next,
    boardTheme: boardTheme !== undefined ? (normalizeBoardThemeId(boardTheme) as BoardTheme) : next.boardTheme,
    pieceTheme: pieceTheme !== undefined ? (normalizePieceThemeId(pieceTheme) as PieceThemeId) : next.pieceTheme,
    coachVoice: next.coachVoice !== undefined ? normalizeCoachVoice(next.coachVoice) : next.coachVoice,
    schoolTheme: schoolTheme && ["elementary", "highschool", "university", "graduation"].includes(schoolTheme)
      ? schoolTheme
      : next.schoolTheme ?? "university",
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

// Load persisted settings on startup.
(async () => {
  try {
    const raw = isWeb ? (typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null) : await SecureStore.getItemAsync(KEY);
    if (raw) {
      state = { ...state, ...normalizeSettings(JSON.parse(raw)) };
      emit();
    }
  } catch {
    /* ignore */
  }
})();

// --- Per-user account sync (so settings follow the user across web + app) ---
let pushTimer: ReturnType<typeof setTimeout> | null = null;
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
  state = { ...state, ...normalizeSettings(remote) };
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
  reset: () => {
    state = { ...DEFAULTS };
    persist();
    emit();
  },
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => {
    state = { ...state, [key]: value };
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
