export type CoachVoiceId =
  | "auto"
  | "emma"
  | "aria"
  | "jane"
  | "grant"
  | "sonia"
  | "natasha"
  | "neerja"
  | "brian"
  | "guy"
  | "roger"
  | "ryan"
  | "william"
  | "tony";

export const COACH_VOICE_GROUPS: { label: string; ids: CoachVoiceId[] }[] = [
  { label: "Smart match", ids: ["auto"] },
  { label: "Coaches", ids: ["emma", "aria", "jane", "grant", "sonia", "natasha", "neerja"] },
  { label: "Narrators", ids: ["brian", "guy", "roger", "ryan", "william", "tony"] },
];

export const COACH_VOICE_OPTIONS: { id: CoachVoiceId; title: string; hint: string; emoji: string }[] = [
  { id: "auto", title: "Match personality", hint: "Voice follows coach style", emoji: "✨" },
  { id: "emma", title: "Emma", hint: "Warm US, friendly", emoji: "😊" },
  { id: "aria", title: "Aria", hint: "Bright US, upbeat", emoji: "🌟" },
  { id: "jane", title: "Jane", hint: "Irish English, crisp", emoji: "🍀" },
  { id: "grant", title: "Grant", hint: "Mature US, calm", emoji: "🎓" },
  { id: "sonia", title: "Sonia", hint: "British, clear", emoji: "🇬🇧" },
  { id: "natasha", title: "Natasha", hint: "Australian, warm", emoji: "🦘" },
  { id: "neerja", title: "Neerja", hint: "Indian English", emoji: "🇮🇳" },
  { id: "brian", title: "Brian", hint: "Storyteller, deep", emoji: "📖" },
  { id: "guy", title: "Guy", hint: "US narrator", emoji: "🎙️" },
  { id: "roger", title: "Roger", hint: "British narrator", emoji: "🎬" },
  { id: "ryan", title: "Ryan", hint: "British, energetic", emoji: "⚡" },
  { id: "william", title: "William", hint: "Australian narrator", emoji: "🌊" },
  { id: "tony", title: "Tony", hint: "US, dramatic", emoji: "🎭" },
];

const VALID = new Set(COACH_VOICE_OPTIONS.map((v) => v.id));

export function normalizeCoachVoice(id: string | undefined): CoachVoiceId {
  if (id && VALID.has(id as CoachVoiceId)) return id as CoachVoiceId;
  return "auto";
}

export function coachVoiceLabel(id: CoachVoiceId): string {
  return COACH_VOICE_OPTIONS.find((v) => v.id === id)?.title ?? id;
}
