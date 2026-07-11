import "server-only";
import { synthesizeEdgeSpeech } from "./edge.server";
import { googleTtsConfigured, synthesizeGoogleSpeech } from "./google.server";
import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";

/** Cloud TTS is always available via Edge; Google is optional when billing is enabled. */
export function ttsConfigured(): boolean {
  return true;
}

export async function synthesizeCoachSpeech(
  text: string,
  personality: CoachPersonality,
  voiceId: CoachVoiceId = "auto",
): Promise<Buffer | null> {
  if (process.env.TTS_PROVIDER === "google" && googleTtsConfigured()) {
    const google = await synthesizeGoogleSpeech(text, personality);
    if (google) return google;
  }

  return synthesizeEdgeSpeech(text, personality, voiceId);
}
