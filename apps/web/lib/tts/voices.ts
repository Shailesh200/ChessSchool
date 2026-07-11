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
  "aria",
  "jane",
  "sara",
  "guy",
  "davis",
  "tony",
  "jason",
  "andrew",
] as const satisfies readonly CoachVoiceId[];

/** Pickable coach voices (Edge neural). `auto` = match personality. */
export const COACH_VOICE_OPTIONS: {
  id: CoachVoiceId;
  title: string;
  hint: string;
  edge: EdgeVoiceProfile;
}[] = [
  { id: "auto", title: "Match personality", hint: "Voice follows coach style", edge: { name: "", rate: 1, pitch: "+0Hz" } },
  { id: "jenny", title: "Jenny", hint: "Warm, friendly", edge: { name: "en-US-JennyNeural", rate: 1.02, pitch: "+2Hz" } },
  { id: "aria", title: "Aria", hint: "Bright, upbeat", edge: { name: "en-US-AriaNeural", rate: 1.04, pitch: "+3Hz" } },
  { id: "jane", title: "Jane", hint: "Clear, concise", edge: { name: "en-US-JaneNeural", rate: 1.0, pitch: "+0Hz" } },
  { id: "sara", title: "Sara", hint: "Calm, steady", edge: { name: "en-US-SaraNeural", rate: 0.98, pitch: "-1Hz" } },
  { id: "guy", title: "Guy", hint: "Firm, direct", edge: { name: "en-US-GuyNeural", rate: 0.96, pitch: "-3Hz" } },
  { id: "davis", title: "Davis", hint: "Measured mentor", edge: { name: "en-US-DavisNeural", rate: 0.94, pitch: "-2Hz" } },
  { id: "tony", title: "Tony", hint: "Energetic coach", edge: { name: "en-US-TonyNeural", rate: 1.06, pitch: "+4Hz" } },
  { id: "jason", title: "Jason", hint: "Neutral announcer", edge: { name: "en-US-JasonNeural", rate: 1.0, pitch: "+0Hz" } },
  { id: "andrew", title: "Andrew", hint: "Warm, relaxed", edge: { name: "en-US-AndrewNeural", rate: 1.0, pitch: "+1Hz" } },
];

/** Personality → voice profiles when coach voice is `auto`. */
export const TTS_VOICES: Record<CoachPersonality, TtsVoiceProfile> = {
  friendly: {
    edge: { name: "en-US-JennyNeural", rate: 1.05, pitch: "+2Hz" },
    google: {
      name: "en-US-Neural2-F",
      languageCode: "en-US",
      speakingRate: 1.02,
      pitch: 1.5,
    },
  },
  strict: {
    edge: { name: "en-US-GuyNeural", rate: 0.94, pitch: "-4Hz" },
    google: {
      name: "en-US-Neural2-D",
      languageCode: "en-US",
      speakingRate: 0.94,
      pitch: -2.0,
    },
  },
  mentor: {
    edge: { name: "en-US-DavisNeural", rate: 0.92, pitch: "-2Hz" },
    google: {
      name: "en-US-Neural2-J",
      languageCode: "en-US",
      speakingRate: 0.92,
      pitch: -1.0,
    },
  },
  tactical: {
    edge: { name: "en-US-TonyNeural", rate: 1.08, pitch: "+4Hz" },
    google: {
      name: "en-US-Neural2-A",
      languageCode: "en-US",
      speakingRate: 1.08,
      pitch: 2.0,
    },
  },
  minimal: {
    edge: { name: "en-US-JaneNeural", rate: 1.12, pitch: "+0Hz" },
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
  if (voiceId !== "auto") {
    const picked = COACH_VOICE_OPTIONS.find((o) => o.id === voiceId);
    if (picked?.edge.name) return picked.edge;
  }
  return TTS_VOICES[personality]?.edge ?? TTS_VOICES.friendly.edge;
}
