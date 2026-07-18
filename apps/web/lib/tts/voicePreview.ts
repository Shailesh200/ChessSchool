import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";
import { COACH_CHARACTERS } from "@/features/coaching/characters";
import { COACH_VOICE_GROUPS, normalizeCoachVoice } from "./voices";

/** Character sample — used when voice is `auto`. */
const PERSONALITY_PREVIEW: Record<CoachPersonality, string> = {
  anxious_nerd: COACH_CHARACTERS.anxious_nerd.previewLine,
  genz: COACH_CHARACTERS.genz.previewLine,
  sassy: COACH_CHARACTERS.sassy.previewLine,
  sarcastic: COACH_CHARACTERS.sarcastic.previewLine,
  egoistic: COACH_CHARACTERS.egoistic.previewLine,
};

/** Per-voice samples — coach tiles sound like in-game coaching; narrators like match storytelling. */
const VOICE_PREVIEW: Partial<Record<CoachVoiceId, string>> = {
  emma: "Hey — lovely spot on that knight fork! Keep that same energy on the next puzzle.",
  aria: "Yes! That's exactly the kind of bright, sharp idea I love to see — you're on fire today!",
  jane: "Nice one. The bishop found a gorgeous diagonal — that's the clarity we're building toward.",
  grant:
    "Good. You saw the tactic and played it calmly. That's how strong players think under pressure.",
  sonia:
    "Well played — you handled that middlegame rather elegantly. Quite promising, I must say.",
  natasha:
    "Brilliant — you sniffed out the trick straight away! Love that fighting spirit, mate.",
  neerja:
    "Wonderful work — you trusted your calculation, and it paid off beautifully. Keep going.",
  brian:
    "The king wandered into the open, and slowly, inevitability began to close in around him.",
  guy: "White played e4. The centre became a battlefield, and Black had to answer with purpose.",
  roger:
    "In the decisive moment, one move separated triumph from disaster — and the line held.",
  ryan: "The position demanded accuracy, and on this occasion, precision carried the day.",
  william:
    "Bit of a scramble in the middlegame, but that's chess — messy, human, and never dull.",
  tony: "Knight to f6 — and suddenly the whole position exploded with tactical possibilities!",
};

const NARRATOR_IDS = new Set<CoachVoiceId>(
  COACH_VOICE_GROUPS.find((g) => g.label === "Narrators")?.ids ?? [],
);

function isNarratorVoice(id: CoachVoiceId): boolean {
  return NARRATOR_IDS.has(id);
}

export function voicePreviewKind(
  id: CoachVoiceId,
): "coach" | "narrator" | "personality" {
  const canonical = normalizeCoachVoice(id);
  if (canonical === "auto") return "personality";
  return isNarratorVoice(canonical) ? "narrator" : "coach";
}

export function voicePreviewText(
  voiceId: CoachVoiceId,
  personality: CoachPersonality,
): string {
  const id = normalizeCoachVoice(voiceId);
  if (id === "auto") return PERSONALITY_PREVIEW[personality] ?? PERSONALITY_PREVIEW.sarcastic;
  return VOICE_PREVIEW[id] ?? PERSONALITY_PREVIEW[personality] ?? PERSONALITY_PREVIEW.sarcastic;
}
