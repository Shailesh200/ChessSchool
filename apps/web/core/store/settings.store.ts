"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export type BoardTheme = string; // see core/themes/themes.ts BOARD_THEMES
export type SchoolTheme = string; // see core/themes/themes.ts SCHOOL_THEMES
export type PieceTheme =
  "classic" | "marble" | "crystal" | "neon" | "forest" | "ocean" | "cute";
export type ColorblindMode = "none" | "deuteranopia";
export type CoachPersonality =
  "friendly" | "strict" | "mentor" | "tactical" | "minimal";

/** TTS voice — `auto` follows coach personality; otherwise a fixed Edge neural voice. */
export type CoachVoiceId =
  | "auto"
  | "jenny"
  | "aria"
  | "jane"
  | "sara"
  | "guy"
  | "davis"
  | "tony"
  | "jason"
  | "andrew";

export interface SettingsState {
  sound: boolean;
  volume: number; // 0..1
  /** Read coach / bot chat bubbles aloud (cloud TTS). */
  coachSpeech: boolean;
  /** Spoken voice — independent of personality wording. */
  coachVoice: CoachVoiceId;
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
  /** Share Core Web Vitals with ChessSchool (anonymous RUM). */
  sharePerformance: boolean;
  /** Share product events (lesson complete, signup, etc.). */
  shareAnalytics: boolean;
  targetElo: number; // 500..2500
  textScale: number; // 1 = 100%

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  /** Apply many settings in one update (avoids re-render / theme flicker cascades). */
  applyPatch: (
    patch: Partial<Omit<SettingsState, "set" | "toggle" | "reset" | "applyPatch">>,
  ) => void;
  toggle: (key: BooleanSettingKey) => void;
  reset: () => void;
}

type BooleanSettingKey = {
  [K in keyof SettingsState]: SettingsState[K] extends boolean ? K : never;
}[keyof SettingsState];

const defaults = {
  sound: true,
  volume: 1,
  coachSpeech: true,
  coachVoice: "auto" as CoachVoiceId,
  haptics: true,
  reducedMotion: false,
  hints: true,
  highContrast: false,
  colorblind: "none" as ColorblindMode,
  boardTheme: "classic" as BoardTheme,
  schoolTheme: "university" as SchoolTheme,
  appTheme: "default",
  pieceTheme: "classic" as PieceTheme,
  coachPersonality: "friendly" as CoachPersonality,
  diagnostics: false,
  sharePerformance: true,
  shareAnalytics: true,
  targetElo: 600,
  textScale: 1,
};

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (key, value) => set({ [key]: value } as Partial<SettingsState>),
      applyPatch: (patch) =>
        set((s) => {
          const next: Partial<SettingsState> = {};
          for (const [key, value] of Object.entries(patch) as [
            keyof SettingsState,
            SettingsState[keyof SettingsState],
          ][]) {
            if (value === undefined) continue;
            if (s[key] !== value) next[key] = value as never;
          }
          return Object.keys(next).length > 0 ? next : s;
        }),
      toggle: (key) => set((s) => ({ [key]: !s[key] }) as Partial<SettingsState>),
      reset: () => set({ ...defaults }),
    }),
    {
      name: "chessschool.settings",
      storage: createJSONStorage(() => localStorage),
      version: 5,
      skipHydration: true,
      // v1 -> v2: introduce schoolTheme; older board themes still resolve.
      // v2 -> v3: anonymous RUM + product analytics opt-out toggles.
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState>;
        if (version < 2) {
          if (!s.schoolTheme) s.schoolTheme = "university";
          if (!s.boardTheme) s.boardTheme = "classic";
        }
        if (version < 3) {
          if (s.sharePerformance === undefined) s.sharePerformance = true;
          if (s.shareAnalytics === undefined) s.shareAnalytics = true;
        }
        if (version < 4) {
          if (s.coachSpeech === undefined) s.coachSpeech = true;
        }
        if (version < 5) {
          if (!s.coachVoice) s.coachVoice = "auto";
        }
        return { ...defaults, ...s } as SettingsState;
      },
    },
  ),
);
