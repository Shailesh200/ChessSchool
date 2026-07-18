/** Mirrors web coach character catalog for mobile settings / TTS / avatars. */

export const COACH_CHARACTER_IDS = [
  "anxious_nerd",
  "genz",
  "sassy",
  "sarcastic",
  "egoistic",
] as const;

export type CoachCharacterId = (typeof COACH_CHARACTER_IDS)[number];

export type CoachAvatarState =
  | "idle"
  | "breathe"
  | "speak"
  | "success"
  | "miss"
  | "think"
  | "signature";

export type CoachCharacter = {
  id: CoachCharacterId;
  name: string;
  theme: string;
  elevenLabsVoiceId: string;
  accent: string;
  successMotion: "nod" | "celebrate";
  signatureMotion: "nervous" | "hype" | "smug" | "deadpan" | "alpha";
  previewLine: string;
  image: number;
};

const LEGACY: Record<string, CoachCharacterId> = {
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
  if (typeof id === "string" && id in LEGACY) return LEGACY[id]!;
  return "sarcastic";
}

export const COACH_CHARACTERS: Record<CoachCharacterId, CoachCharacter> = {
  anxious_nerd: {
    id: "anxious_nerd",
    name: "Otto",
    theme: "Anxious / Nerd",
    elevenLabsVoiceId: "mrQhZWGbb2k9qWJb5qeA",
    accent: "#818cf8",
    successMotion: "nod",
    signatureMotion: "nervous",
    previewLine:
      "Okay. Stay with me. Let's play safe.",
    image: require("../assets/coaches/otto-premium.png"),
  },
  genz: {
    id: "genz",
    name: "Kira",
    theme: "GenZ",
    elevenLabsVoiceId: "6u6JbqKdaQy89ENzLSju",
    accent: "#f472b6",
    successMotion: "celebrate",
    signatureMotion: "hype",
    previewLine: "Yo. Lock in. Let's cook.",
    image: require("../assets/coaches/kira-premium.png"),
  },
  sassy: {
    id: "sassy",
    name: "Skye",
    theme: "Sassy",
    elevenLabsVoiceId: "03vEurziQfq3V8WZhQvn",
    accent: "#34d399",
    successMotion: "celebrate",
    signatureMotion: "smug",
    previewLine:
      "Welcome, baby. Try not to hang anything.",
    image: require("../assets/coaches/skye-premium.png"),
  },
  sarcastic: {
    id: "sarcastic",
    name: "Ash",
    theme: "Sarcastic",
    elevenLabsVoiceId: "lCfIptVKzlPoj4vLmTLz",
    accent: "#94a3b8",
    successMotion: "nod",
    signatureMotion: "deadpan",
    previewLine:
      "Bold of you to show up. Let's begin.",
    image: require("../assets/coaches/ash-premium.png"),
  },
  egoistic: {
    id: "egoistic",
    name: "Rex",
    theme: "Egoistic / Alpha",
    elevenLabsVoiceId: "UXrpoYalpW5MpGiFHq3z",
    accent: "#fbbf24",
    successMotion: "celebrate",
    signatureMotion: "alpha",
    previewLine:
      "Obviously you picked the right coach. Play.",
    image: require("../assets/coaches/rex-premium.png"),
  },
};

export const COACH_CHARACTER_LIST = COACH_CHARACTER_IDS.map(
  (id) => COACH_CHARACTERS[id],
);

export function coachCharacterOf(id: unknown): CoachCharacter {
  return COACH_CHARACTERS[normalizeCoachCharacter(id)];
}
