import "server-only";
import { googleTtsConfigured, synthesizeGoogleSpeech } from "./google.server";
import { elevenLabsConfigured, synthesizeElevenLabsSpeech } from "./elevenlabs.server";
import {
  normalizeCoachCharacter,
  type CoachCharacterId,
} from "@/features/coaching/characters";
import { plainSpeechText } from "@/features/coaching/speechStyle";

/** Cloud TTS when ElevenLabs or Google (`TTS_PROVIDER=google`) is configured. */
export function ttsConfigured(): boolean {
  if (elevenLabsConfigured()) return true;
  return process.env.TTS_PROVIDER === "google" && googleTtsConfigured();
}

export async function synthesizeCoachSpeech(
  text: string,
  characterOrPersonality: CoachCharacterId | string,
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

  // No Edge Read Aloud path. Callers use on-device speech when this returns null.
  return null;
}
