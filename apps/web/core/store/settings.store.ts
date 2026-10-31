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
  /**
   * The one privacy switch. Off until the user turns it on. It covers product events (lesson
   * complete, signup, etc.) AND anonymous page-speed metrics (Core Web Vitals). There is no
   * separate performance setting.
   */
  shareAnalytics: boolean;
  /**
   * Version of the privacy settings. Stored locally and on the account (it syncs with the rest of
   * the settings). A shareAnalytics saved by an older version is not trusted: see
   * PRIVACY_SETTINGS_VERSION.
   */
  settingsVersion: number;
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

/**
 * Everyone was reset to "analytics off" once, when this version was introduced (Arc's ruling: opt-in
 * only). A saved or account copy below this version has its shareAnalytics ignored, so an old "on"
 * (default-on era) can not come back through local storage or an account sync. An opt-in made at
 * this version or later is a real choice and stays. Bump it only for another deliberate reset.
 */
export const PRIVACY_SETTINGS_VERSION = 1;

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
  // Opt-in: nothing is sent until the user turns this on. Also what the app sees before the saved
  // settings have rehydrated (skipHydration).
  shareAnalytics: false,
  settingsVersion: PRIVACY_SETTINGS_VERSION,
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
      version: 14,
      skipHydration: true,
      migrate: (persisted, version) => {
        const s = (persisted ?? {}) as Partial<SettingsState> & {
          coachPersonality?: string;
          coachCharacter?: string;
          uiShell?: string;
          sharePerformance?: boolean;
        };
        // v13 -> v14: the one-time privacy reset. Whatever was saved before (including an "on" from
        // when analytics defaulted to on) is dropped; the copy is stamped so it never runs again.
        // Persist version 13 already folded sharePerformance into the one switch on this branch.
        if (version < 14) {
          s.shareAnalytics = false;
          s.settingsVersion = PRIVACY_SETTINGS_VERSION;
        }
        // v12 -> v13: performance sharing folded into shareAnalytics (one switch). The old key is
        // dropped; it never turns anything on. Persist version 12 is already the uiKit migration
        // on this branch, so this fold is the next version.
        delete s.sharePerformance;
        if (version < 2) {
          if (!s.schoolTheme) s.schoolTheme = "university";
          if (!s.boardTheme) s.boardTheme = "classic";
        }
        if (version < 3) {
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
