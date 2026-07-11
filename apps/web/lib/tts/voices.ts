import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";

export interface EdgeVoiceProfile {
  name: string;
  rate: number;
  pitch: string;
}

export interface GoogleVoiceProfile {
  name: string;
  languageCode: string;
  speakingRate: number;
  pitch: number;
}

export interface TtsVoiceProfile {
  edge: EdgeVoiceProfile;
  google: GoogleVoiceProfile;
}

export const COACH_VOICE_IDS = [
  "auto",
  "jenny",
  "emma",
  "aria",
  "michelle",
  "sonia",
  "natasha",
  "neerja",
  "guy",
  "roger",
  "brian",
  "ryan",
  "william",
  "davis",
  "steffan",
  "tony",
  "jane",
  "sara",
  "jason",
  "andrew",
] as const satisfies readonly CoachVoiceId[];

/**
 * Voices shown in the picker — one face per audibly distinct Edge neural voice.
 * Similar US voices are merged; legacy ids map via `normalizeCoachVoice`.
 */
export const COACH_VOICE_PICKER_IDS = [
  "auto",
  "emma",
  "aria",
  "jane",
  "sara",
  "sonia",
  "natasha",
  "neerja",
  "brian",
  "guy",
  "roger",
  "ryan",
  "william",
  "tony",
] as const satisfies readonly CoachVoiceId[];

/** Retired picker voices → canonical distinct voice (same Edge profile). */
export const COACH_VOICE_ALIASES: Partial<Record<CoachVoiceId, CoachVoiceId>> = {
  jenny: "emma",
  michelle: "aria",
  davis: "guy",
  steffan: "roger",
  jason: "brian",
  andrew: "brian",
};

export function normalizeCoachVoice(id: CoachVoiceId): CoachVoiceId {
  return COACH_VOICE_ALIASES[id] ?? id;
}

export const COACH_VOICE_GROUPS: { label: string; ids: CoachVoiceId[] }[] = [
  { label: "Smart match", ids: ["auto"] },
  {
    label: "Coaches",
    ids: ["emma", "aria", "jane", "sara", "sonia", "natasha", "neerja"],
  },
  {
    label: "Narrators",
    ids: ["brian", "guy", "roger", "ryan", "william", "tony"],
  },
];

/** Pickable coach voices (Edge neural). `auto` = match personality. */
export const COACH_VOICE_OPTIONS: {
  id: CoachVoiceId;
  title: string;
  hint: string;
  edge: EdgeVoiceProfile;
}[] = [
  {
    id: "auto",
    title: "Match personality",
    hint: "Voice follows coach style",
    edge: { name: "", rate: 1, pitch: "+0Hz" },
  },
  // —— US female ——
  {
    id: "emma",
    title: "Emma",
    hint: "Warm US, friendly",
    edge: { name: "en-US-EmmaNeural", rate: 0.98, pitch: "+1Hz" },
  },
  {
    id: "aria",
    title: "Aria",
    hint: "Bright US, upbeat",
    edge: { name: "en-US-AriaNeural", rate: 1.06, pitch: "+4Hz" },
  },
  {
    id: "jane",
    title: "Jane",
    hint: "Irish English, crisp",
    edge: { name: "en-IE-EmilyNeural", rate: 1.02, pitch: "+1Hz" },
  },
  {
    id: "sara",
    title: "Sara",
    hint: "Mature US, calm & low",
    edge: { name: "en-US-NancyNeural", rate: 0.86, pitch: "-8Hz" },
  },
  // —— British / Australian / Indian female ——
  {
    id: "sonia",
    title: "Sonia",
    hint: "British, polished",
    edge: { name: "en-GB-SoniaNeural", rate: 0.96, pitch: "+1Hz" },
  },
  {
    id: "natasha",
    title: "Natasha",
    hint: "Australian, lively",
    edge: { name: "en-AU-NatashaNeural", rate: 1.04, pitch: "+3Hz" },
  },
  {
    id: "neerja",
    title: "Neerja",
    hint: "Indian English, warm",
    edge: { name: "en-IN-NeerjaNeural", rate: 0.98, pitch: "+2Hz" },
  },
  // —— US / British / Australian male ——
  {
    id: "guy",
    title: "Guy",
    hint: "Firm US, direct",
    edge: { name: "en-US-GuyNeural", rate: 0.92, pitch: "-5Hz" },
  },
  {
    id: "roger",
    title: "Roger",
    hint: "Deep US, authoritative",
    edge: { name: "en-US-RogerNeural", rate: 0.9, pitch: "-6Hz" },
  },
  {
    id: "brian",
    title: "Brian",
    hint: "Warm US, mentor tone",
    edge: { name: "en-US-BrianNeural", rate: 0.94, pitch: "-3Hz" },
  },
  {
    id: "ryan",
    title: "Ryan",
    hint: "British, crisp",
    edge: { name: "en-GB-RyanNeural", rate: 0.98, pitch: "-2Hz" },
  },
  {
    id: "william",
    title: "William",
    hint: "Australian, relaxed",
    edge: { name: "en-AU-WilliamNeural", rate: 0.96, pitch: "-3Hz" },
  },
  {
    id: "tony",
    title: "Tony",
    hint: "Energetic US, coach",
    edge: { name: "en-US-ChristopherNeural", rate: 1.14, pitch: "+6Hz" },
  },
];

/** Personality → voice profiles when coach voice is `auto`. */
export const TTS_VOICES: Record<CoachPersonality, TtsVoiceProfile> = {
  friendly: {
    edge: { name: "en-US-EmmaNeural", rate: 1.0, pitch: "+2Hz" },
    google: {
      name: "en-US-Neural2-F",
      languageCode: "en-US",
      speakingRate: 1.0,
      pitch: 2.0,
    },
  },
  strict: {
    edge: { name: "en-GB-RyanNeural", rate: 0.92, pitch: "-4Hz" },
    google: {
      name: "en-GB-Neural2-B",
      languageCode: "en-GB",
      speakingRate: 0.9,
      pitch: -3.0,
    },
  },
  mentor: {
    edge: { name: "en-US-BrianNeural", rate: 0.94, pitch: "-3Hz" },
    google: {
      name: "en-US-Neural2-J",
      languageCode: "en-US",
      speakingRate: 0.92,
      pitch: -2.0,
    },
  },
  tactical: {
    edge: { name: "en-AU-NatashaNeural", rate: 1.06, pitch: "+4Hz" },
    google: {
      name: "en-US-Neural2-A",
      languageCode: "en-US",
      speakingRate: 1.08,
      pitch: 3.0,
    },
  },
  minimal: {
    edge: { name: "en-IE-EmilyNeural", rate: 1.1, pitch: "+0Hz" },
    google: {
      name: "en-US-Neural2-C",
      languageCode: "en-US",
      speakingRate: 1.12,
      pitch: 0,
    },
  },
};

export const TTS_MAX_CHARS = 500;

export function resolveEdgeVoice(
  personality: CoachPersonality,
  voiceId: CoachVoiceId,
): EdgeVoiceProfile {
  const id = normalizeCoachVoice(voiceId);
  if (id !== "auto") {
    const picked = COACH_VOICE_OPTIONS.find((o) => o.id === id);
    if (picked?.edge.name) return picked.edge;
  }
  return TTS_VOICES[personality]?.edge ?? TTS_VOICES.friendly.edge;
}
