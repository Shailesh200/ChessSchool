import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PieceThemeId } from "./Piece";

export type BoardTheme = "classic" | "green" | "wood";
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
};

const KEY = "chessschool.settings";
const isWeb = Platform.OS === "web";
let state: Settings = {
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
};
const listeners = new Set<() => void>();

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
      state = { ...state, ...JSON.parse(raw) };
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
      const { api } = await import("./api");
      const { progressStore } = await import("./progressStore");
      const snap = (progressStore.get() as Record<string, unknown> | null) ?? (await api<Record<string, unknown>>("/api/progress"));
      const { user: _u, ...rest } = snap as { user?: unknown } & Record<string, unknown>;
      const body = { ...rest, settings: state };
      await api("/api/progress", { method: "POST", body });
      progressStore.set(body);
    } catch {
      /* ignore (offline / logged out) */
    }
  }, 700);
}

/** Apply settings stored on the account (called on login). Does not re-sync. */
export function hydrateSettings(remote: Partial<Settings> | null | undefined) {
  if (!remote || typeof remote !== "object") return;
  state = { ...state, ...remote };
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
export const BOARD_THEMES: Record<BoardTheme, { light: string; dark: string }> = {
  classic: { light: "#eef0f4", dark: "#7c8aa5" },
  green: { light: "#e9eef0", dark: "#6a9b78" },
  wood: { light: "#e8cfa6", dark: "#a9743f" },
};
