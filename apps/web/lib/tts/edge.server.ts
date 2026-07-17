import "server-only";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import type { Readable } from "stream";
import type { CoachPersonality, CoachVoiceId } from "@/core/store/settings.store";
import { resolveEdgeVoice, TTS_MAX_CHARS } from "./voices";

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function streamToBuffer(stream: Readable): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

/** Synthesize MP3 via Microsoft Edge Read Aloud (no API key or billing). */
export async function synthesizeEdgeSpeech(
  text: string,
  personality: CoachPersonality,
  voiceId: CoachVoiceId = "auto",
): Promise<Buffer | null> {
  const trimmed = escapeXml(text.trim().slice(0, TTS_MAX_CHARS));
  if (!trimmed) return null;

  const voice = resolveEdgeVoice(personality, voiceId);

  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(voice.name, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const { audioStream } = await tts.toStream(trimmed, {
      rate: voice.rate,
      pitch: voice.pitch,
    });
    return await streamToBuffer(audioStream);
  } catch (err) {
    console.error("Edge TTS error", err);
    return null;
  }
}
