/** The four lesson coaches. Cody stays the mascot; the coach is the voice in lessons. */
export const COACHES = [
  { id: "meera", name: "Coach Meera", blurb: "A patient teacher who goes step by step", voiceId: "Kfn3fYy8XcPyUvbTxn1H" },
  { id: "vikram", name: "Coach Vikram", blurb: "Calm and wise, always explains the why", voiceId: "9PvnT6XRzlljoaDG6Knu" },
  { id: "rohan", name: "Coach Rohan", blurb: "A friendly big brother who cheers you on", voiceId: "HH8sIQq8WOcER3Nu118i" },
  { id: "tara", name: "Coach Tara", blurb: "Bright and playful, celebrates every win", voiceId: "4O1sYUnmtThcBoSBrri7" },
] as const;
export type CoachId = (typeof COACHES)[number]["id"];
export const isCoachId = (v: unknown): v is CoachId => COACHES.some((c) => c.id === v);
export const coachOf = (id: CoachId) => COACHES.find((c) => c.id === id)!;

export const VOICE_SPEEDS = [0.85, 1, 1.15] as const;
export type VoiceSpeed = (typeof VOICE_SPEEDS)[number];

const norm = (text: string) => text.replace(/\s+/g, " ").trim();

/** Stable id for a spoken line: two 32-bit FNV-1a hashes of the normalised text. Server and apps must agree. */
export function voiceKey(text: string): string {
  const t = norm(text);
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ t.length;
  for (let i = 0; i < t.length; i++) {
    const ch = t.charCodeAt(i);
    a = Math.imul(a ^ ch, 0x01000193) >>> 0;
    b = Math.imul(b ^ ch, 0x5bd1e995) >>> 0;
  }
  return a.toString(16).padStart(8, "0") + b.toString(16).padStart(8, "0");
}
