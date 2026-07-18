import "server-only";
import { synthesizeEdgeSpeech } from "./edge.server";
import { googleTtsConfigured, synthesizeGoogleSpeech } from "./google.server";
import {
  elevenLabsConfigured,
  synthesizeElevenLabsSpeech,
} from "./elevenlabs.server";
import type { CoachVoiceId } from "@/core/store/settings.store";
import {
  normalizeCoachCharacter,
  type CoachCharacterId,
} from "@/features/coaching/characters";
import { plainSpeechText } from "@/features/coaching/speechStyle";

/** Cloud TTS is always available via Edge; ElevenLabs / Google when configured. */
export function ttsConfigured(): boolean {
  return true;
}

export async function synthesizeCoachSpeech(
  text: string,
  characterOrPersonality: CoachCharacterId | string,
  voiceId: CoachVoiceId = "auto",
): Promise<Buffer | null> {
  const character = normalizeCoachCharacter(characterOrPersonality);
  const plain = plainSpeechText(text);

  if (elevenLabsConfigured()) {
    const eleven = await synthesizeElevenLabsSpeech(plain, character);
    if (eleven) return eleven;
  }

  if (process.env.TTS_PROVIDER === "google" && googleTtsConfigured()) {
    const google = await synthesizeGoogleSpeech(plain, character);
    if (google) return google;
  }

  return synthesizeEdgeSpeech(plain, character, voiceId);
}
