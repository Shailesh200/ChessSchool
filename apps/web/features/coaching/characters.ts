/** Named coach characters — voice, copy tone, and avatar. */

export const COACH_CHARACTER_IDS = [
  "anxious_nerd",
  "genz",
  "sassy",
  "sarcastic",
  "egoistic",
] as const;

export type CoachCharacterId = (typeof COACH_CHARACTER_IDS)[number];

/** @deprecated Use CoachCharacterId — kept for gradual rename. */
export type CoachPersonality = CoachCharacterId;

export type CoachAvatarState =
  | "idle"
  | "breathe"
  | "speak"
  | "success"
  | "miss"
  | "think"
  | "signature";

/** Exact Voice Lab / API voice settings — do not invent these. */
export type ElevenLabsVoiceSettings = {
  stability: number;
  similarity_boost: number;
  style: number;
  speed: number;
  use_speaker_boost: boolean;
};

export type CoachCharacter = {
  id: CoachCharacterId;
  name: string;
  theme: string;
  gender: "male" | "female";
  elevenLabsVoiceId: string;
  /**
   * Model used in Voice Lab for this voice.
   * Multilingual v2 matches library character voices; Skye HQ list prefers Turbo.
   */
  elevenLabsModelId: string;
  /** Pulled from GET /v1/voices/{id}/settings — must match Voice Lab. */
  elevenLabsSettings: ElevenLabsVoiceSettings;
  /** Public URL path (web) */
  imageSrc: string;
  accent: string;
  /** Success motion variant */
  successMotion: "nod" | "celebrate";
  signatureMotion: "nervous" | "hype" | "smug" | "deadpan" | "alpha";
  /** Plain line shown in Settings and sent to TTS */
  previewLine: string;
  /** Edge neural voice when ElevenLabs unavailable */
  edgeVoiceFallback: string;
};

/**
 * Voice settings snapshotted from ElevenLabs API (2026-07-19).
 * Re-fetch with GET /v1/voices/{id}/settings if Voice Lab sliders change.
 */
export const COACH_CHARACTERS: Record<CoachCharacterId, CoachCharacter> = {
  anxious_nerd: {
    id: "anxious_nerd",
    name: "Otto",
    theme: "Anxious / Nerd",
    gender: "male",
    elevenLabsVoiceId: "mrQhZWGbb2k9qWJb5qeA",
    elevenLabsModelId: "eleven_multilingual_v2",
    elevenLabsSettings: {
      stability: 0.5,
      similarity_boost: 0.44,
      style: 0.49,
      speed: 0.97,
      use_speaker_boost: true,
    },
    imageSrc: "/coaches/otto-premium.png",
    accent: "#818cf8",
    successMotion: "nod",
    signatureMotion: "nervous",
    previewLine: "Okay. Stay with me. Let's play safe.",
    edgeVoiceFallback: "en-US-GuyNeural",
  },
  genz: {
    id: "genz",
    name: "Kira",
    theme: "GenZ",
    gender: "female",
    elevenLabsVoiceId: "6u6JbqKdaQy89ENzLSju",
    elevenLabsModelId: "eleven_multilingual_v2",
    elevenLabsSettings: {
      stability: 0.11,
      similarity_boost: 0.75,
      style: 0.45,
      speed: 1.08,
      use_speaker_boost: true,
    },
    imageSrc: "/coaches/kira-premium.png",
    accent: "#f472b6",
    successMotion: "celebrate",
    signatureMotion: "hype",
    previewLine: "Yo. Lock in. Let's cook.",
    edgeVoiceFallback: "en-US-AriaNeural",
  },
  sassy: {
    id: "sassy",
    name: "Skye",
    theme: "Sassy",
    gender: "female",
    /** Aerisita — Sassy and Comedic (Southern, over-the-top). */
    elevenLabsVoiceId: "03vEurziQfq3V8WZhQvn",
    /** HQ models for this voice are Turbo/Flash — Turbo matches Voice Lab listen. */
    elevenLabsModelId: "eleven_turbo_v2_5",
    elevenLabsSettings: {
      stability: 0.75,
      similarity_boost: 0.75,
      style: 0.0,
      speed: 1.0,
      use_speaker_boost: true,
    },
    imageSrc: "/coaches/skye-premium.png",
    accent: "#34d399",
    successMotion: "celebrate",
    signatureMotion: "smug",
    previewLine: "Welcome, baby. Try not to hang anything.",
    edgeVoiceFallback: "en-US-JennyNeural",
  },
  sarcastic: {
    id: "sarcastic",
    name: "Ash",
    theme: "Sarcastic",
    gender: "male",
    elevenLabsVoiceId: "lCfIptVKzlPoj4vLmTLz",
    elevenLabsModelId: "eleven_multilingual_v2",
    elevenLabsSettings: {
      stability: 0.66,
      similarity_boost: 0.7,
      style: 0.19,
      speed: 0.91,
      use_speaker_boost: true,
    },
    imageSrc: "/coaches/ash-premium.png",
    accent: "#94a3b8",
    successMotion: "nod",
    signatureMotion: "deadpan",
    previewLine: "Bold of you to show up. Let's begin.",
    edgeVoiceFallback: "en-US-DavisNeural",
  },
  egoistic: {
    id: "egoistic",
    name: "Rex",
    theme: "Egoistic / Alpha",
    gender: "male",
    elevenLabsVoiceId: "UXrpoYalpW5MpGiFHq3z",
    elevenLabsModelId: "eleven_multilingual_v2",
    elevenLabsSettings: {
      stability: 0.9,
      similarity_boost: 0.75,
      style: 0.14,
      speed: 1.04,
      use_speaker_boost: true,
    },
    imageSrc: "/coaches/rex-premium.png",
    accent: "#fbbf24",
    successMotion: "celebrate",
    signatureMotion: "alpha",
    previewLine: "Obviously you picked the right coach. Play.",
    edgeVoiceFallback: "en-US-RogerNeural",
  },
};

export const COACH_CHARACTER_LIST = COACH_CHARACTER_IDS.map(
  (id) => COACH_CHARACTERS[id],
);

const LEGACY_PERSONALITY: Record<string, CoachCharacterId> = {
  friendly: "genz",
  strict: "sarcastic",
  mentor: "anxious_nerd",
  tactical: "egoistic",
  minimal: "sassy",
  anxious_nerd: "anxious_nerd",
  genz: "genz",
  sassy: "sassy",
  sarcastic: "sarcastic",
  egoistic: "egoistic",
};

export function normalizeCoachCharacter(id: unknown): CoachCharacterId {
  if (typeof id === "string" && id in LEGACY_PERSONALITY) {
    return LEGACY_PERSONALITY[id]!;
  }
  return "sarcastic";
}

export function coachCharacterOf(id: unknown): CoachCharacter {
  return COACH_CHARACTERS[normalizeCoachCharacter(id)];
}

export function isCoachCharacterId(id: unknown): id is CoachCharacterId {
  return typeof id === "string" && (COACH_CHARACTER_IDS as readonly string[]).includes(id);
}
