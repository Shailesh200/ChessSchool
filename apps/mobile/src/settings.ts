import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PieceThemeId } from "./Piece";

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
  | "wood"; // legacy alias → wooden
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
  goal: string;
  boardTheme: BoardTheme;
  pieceTheme: PieceThemeId;
  appTheme: string;
};

const KEY = "chessschool.settings";
const isWeb = Platform.OS === "web";
const DEFAULTS: Settings = {
  haptics: true,
  sound: true,
  volume: 0.8,
  reducedMotion: false,
  highContrast: false,
  colorblind: false,
  hints: true,
  targetElo: 600,
  planTier: "standard",
  customGoalXp: 60,
  schedule: "daily",
  avatar: "🎓",
  coachPersonality: "friendly",
  goal: "",
  boardTheme: "classic",
  pieceTheme: "classic",
  appTheme: "default",
};
let state: Settings = { ...DEFAULTS };
const listeners = new Set<() => void>();

function normalizeSettings(next: Partial<Settings>): Partial<Settings> {
  const pieceTheme = (next as { pieceTheme?: string }).pieceTheme;
  return {
    ...next,
    pieceTheme: pieceTheme === "blossom" ? "cute" : next.pieceTheme,
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
};

/** Themes shown in the picker (excludes legacy aliases). */
export const SELECTABLE_BOARD_THEMES: BoardTheme[] = ["classic", "chalkboard", "marble", "tournament", "wooden", "neon", "paper", "midnight"];
export const BOARD_THEME_NAMES: Record<string, string> = {
  classic: "Classic", chalkboard: "Chalkboard", marble: "Marble", tournament: "Tournament", wooden: "Wooden", neon: "Neon", paper: "Paper", midnight: "Midnight",
};
