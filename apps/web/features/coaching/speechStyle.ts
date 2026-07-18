/**
 * Prepare coach lines for TTS.
 *
 * Important: do NOT invent ElevenLabs v3 audio tags ([laughs], [playfully], …).
 * Those made delivery diverge from Voice Lab. The accent/character lives in the
 * cloned voice + exact Voice Lab slider settings.
 *
 * UI may still contain legacy tagged preview scripts — strip them for synthesis
 * on multilingual / turbo / flash models.
 */

/** Remove v3 / SSML performance markup for TTS models that don't use tags. */
export function plainSpeechText(text: string): string {
  return text
    .replace(/\[[^\]]+\]/g, " ")
    .replace(/<\/?break\b[^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Text sent to ElevenLabs. Keeps natural punctuation the voice was trained on;
 * strips performance tags that Voice Lab characters don't need.
 */
export function styleCoachSpeechForTts(text: string): string {
  return plainSpeechText(text).slice(0, 900);
}
