import { useSyncExternalStore } from "react";
import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import type { PieceThemeId } from "./Piece";

export type BoardTheme = "classic" | "green" | "wood";
export type Settings = { haptics: boolean; sound: boolean; reducedMotion: boolean; boardTheme: BoardTheme; pieceTheme: PieceThemeId };

const KEY = "chessschool.settings";
const isWeb = Platform.OS === "web";
let state: Settings = { haptics: true, sound: true, reducedMotion: false, boardTheme: "classic", pieceTheme: "marble" };
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

export const settings = {
  get: () => state,
  set: <K extends keyof Settings>(key: K, value: Settings[K]) => {
    state = { ...state, [key]: value };
    persist();
    emit();
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
