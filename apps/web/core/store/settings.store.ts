"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { normalizeCoachVoice } from "@/lib/tts/voices";
import {
  DEFAULT_COACH_CHARACTER,
  type CoachCharacterId,
  normalizeCoachCharacter,
} from "@/features/coaching/characters";

export type BoardTheme = string; // see core/themes/themes.ts BOARD_THEMES
export type SchoolTheme = string; // see core/themes/themes.ts SCHOOL_THEMES
export type PieceTheme =
  | "classic"
  | "merida"
  | "alpha"
  | "marble"
  | "crystal"
  | "neon"
  | "forest"
  | "ocean"
  | "cartoon"
  | "fairytale"
  | "anime"
  | "fantasy";
export type ColorblindMode = "none" | "deuteranopia";

/** Premium Illustrated (default) vs pre-nov2 Classic UI rollback. */
export type UiKitMode = "premium" | "legacy";

/** @deprecated Use CoachCharacterId from features/coaching/characters */
export type CoachPersonality = CoachCharacterId;
export type { CoachCharacterId };

/** TTS voice — legacy Edge picker; character voices use ElevenLabs. Kept for migrate/fallback. */
export type CoachVoiceId =
  | "auto"
  | "jenny"
  | "aria"
  | "emma"
  | "michelle"
  | "sonia"
  | "natasha"
  | "neerja"
  | "guy"
  | "davis"
  | "roger"
  | "brian"
  | "ryan"
  | "william"
  | "tony"
  | "steffan"
  | "jane"
  | "grant"
  | "sara"
  | "jason"
  | "andrew";

export interface SettingsState {
  sound: boolean;
  volume: number; // 0..1
  /** Read coach / bot chat bubbles aloud (cloud TTS). */
  coachSpeech: boolean;
  /** @deprecated Character selects the voice; kept for Edge fallback / migrate. */
  coachVoice: CoachVoiceId;
  haptics: boolean;
  reducedMotion: boolean;
  hints: boolean;
  highContrast: boolean;
  colorblind: ColorblindMode;
  boardTheme: BoardTheme;
  schoolTheme: SchoolTheme;
  appTheme: string; // global surface palette — see core/themes/themes.ts APP_THEMES
  /** Premium Illustrated design kit (default) or legacy Classic UI. */
  uiKit: UiKitMode;
  pieceTheme: PieceTheme;
  /** Named coach character (voice + phrases + avatar). */
  coachCharacter: CoachCharacterId;
  /**
   * Legacy alias — mirrors coachCharacter for older sync clients.
   * Prefer coachCharacter in new code.
   */
  coachPersonality: CoachCharacterId;
  diagnostics: boolean;
  /** Share Core Web Vitals with ChessSchool (anonymous RUM). */
  sharePerformance: boolean;
  /** Share product events (lesson complete, signup, etc.). */
  shareAnalytics: boolean;
  targetElo: number; // 500..2500
  textScale: number; // 1 = 100%
  /** Epoch ms when guest dismissed the enroll prompt — snooze 7 days. */
  enrollPromptDismissedAt: number | null;

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
  uiKit: "premium" as UiKitMode,
  pieceTheme: "classic" as PieceTheme,
  coachCharacter: DEFAULT_COACH_CHARACTER,
  coachPersonality: DEFAULT_COACH_CHARACTER,
  diagnostics: false,
  sharePerformance: true,
  // Opt-in: nothing is sent until the user turns this on. Also what the app sees before the saved
  // settings have rehydrated (skipHydration).
  shareAnalytics: false,
  targetElo: 600,
  textScale: 1,
  enrollPromptDismissedAt: null as number | null,
};

function syncCoachFields(patch: Partial<SettingsState>): Partial<SettingsState> {
  if (patch.coachCharacter !== undefined) {
    const c = normalizeCoachCharacter(patch.coachCharacter);
    return { ...patch, coachCharacter: c, coachPersonality: c };
  }
  if (patch.coachPersonality !== undefined) {
    const c = normalizeCoachCharacter(patch.coachPersonality);
    return { ...patch, coachCharacter: c, coachPersonality: c };
  }
  return patch;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaults,
      set: (key, value) =>
        set((s) => {
          const patch = syncCoachFields({ [key]: value } as Partial<SettingsState>);
          return { ...s, ...patch };
        }),
      applyPatch: (patch) =>
        set((s) => {
          const synced = syncCoachFields(patch);
          const next: Partial<SettingsState> = {};
          for (const [key, value] of Object.entries(synced) as [
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
      version: 12,
      skipHydration: true,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState> & {
          coachPersonality?: string;
          coachCharacter?: string;
          uiShell?: string;
        };
        if (version < 2) {
          if (!s.schoolTheme) s.schoolTheme = "university";
          if (!s.boardTheme) s.boardTheme = "classic";
        }
        if (version < 3) {
          if (s.sharePerformance === undefined) s.sharePerformance = true;
          if (s.shareAnalytics === undefined) s.shareAnalytics = false;
        }
        if (version < 4) {
          if (s.coachSpeech === undefined) s.coachSpeech = true;
        }
        if (version < 5) {
          if (!s.coachVoice) s.coachVoice = "auto";
        }
        if (version < 6 && s.coachVoice) {
          s.coachVoice = normalizeCoachVoice(s.coachVoice);
        }
        const piece = s.pieceTheme as string | undefined;
        if (version < 7 && piece === "cute") {
          s.pieceTheme = "fantasy";
        }
        if (version < 8 && piece === "cute") {
          s.pieceTheme = "cartoon";
        }
        if (version < 9 && (piece === "barbie" || piece === "princess")) {
          s.pieceTheme = "fairytale";
        }
        if (version < 10 && s.enrollPromptDismissedAt === undefined) {
          s.enrollPromptDismissedAt = null;
        }
        // v10 -> v11: named coach characters
        if (version < 11) {
          const from =
            s.coachCharacter ?? s.coachPersonality ?? DEFAULT_COACH_CHARACTER;
          const c = normalizeCoachCharacter(from);
          s.coachCharacter = c;
          s.coachPersonality = c;
        } else {
          const c = normalizeCoachCharacter(
            s.coachCharacter ?? s.coachPersonality ?? DEFAULT_COACH_CHARACTER,
          );
          s.coachCharacter = c;
          s.coachPersonality = c;
        }
        if (version < 12) {
          if (!s.uiKit) {
            s.uiKit =
              s.uiShell === "classic" || s.uiShell === "legacy" ? "legacy" : "premium";
          }
        }
        return { ...defaults, ...s } as SettingsState;
      },
    },
  ),
);
