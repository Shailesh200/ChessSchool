"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BoardTheme = string; // see core/themes/themes.ts BOARD_THEMES
export type SchoolTheme = string; // see core/themes/themes.ts SCHOOL_THEMES
export type PieceTheme = "classic" | "rounded";
export type ColorblindMode = "none" | "deuteranopia";
export type CoachPersonality =
  | "friendly"
  | "strict"
  | "mentor"
  | "tactical"
  | "minimal";

export interface SettingsState {
  sound: boolean;
  volume: number; // 0..1
  haptics: boolean;
  reducedMotion: boolean;
  hints: boolean;
  highContrast: boolean;
  colorblind: ColorblindMode;
  boardTheme: BoardTheme;
  schoolTheme: SchoolTheme;
  appTheme: string; // global surface palette — see core/themes/themes.ts APP_THEMES
  pieceTheme: PieceTheme;
  coachPersonality: CoachPersonality;
  diagnostics: boolean;
  targetElo: number; // 500..2500
  textScale: number; // 1 = 100%

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  toggle: (key: BooleanSettingKey) => void;
  reset: () => void;
}

type BooleanSettingKey = {
  [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never;
}[keyof SettingsState];

const defaults = {
  sound: true,
  volume: 0.7,
  haptics: true,
  reducedMotion: false,
  hints: true,
  highContrast: false,
  colorblind: "none" as ColorblindMode,
  boardTheme: "classic" as BoardTheme,
  schoolTheme: "university" as SchoolTheme,
  appTheme: "default",
  pieceTheme: "rounded" as PieceTheme,
  coachPersonality: "friendly" as CoachPersonality,
  diagnostics: false,
  targetElo: 800,
  textScale: 1,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      toggle: (key) =>
        set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
      reset: () => set({ ...defaults }),
    }),
    {
      name: "duochess.settings",
      storage: createJSONStorage(() => localStorage),
      version: 2,
      skipHydration: true,
      // v1 -> v2: introduce schoolTheme; older board themes still resolve.
      migrate: (persisted) => {
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (!s.schoolTheme) s.schoolTheme = "university";
        if (!s.boardTheme) s.boardTheme = "classic";
        return { ...defaults, ...s } as SettingsState;
      },
    },
  ),
);
