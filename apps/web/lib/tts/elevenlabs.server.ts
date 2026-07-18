import "server-only";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  coachCharacterOf,
  type CoachCharacterId,
} from "@/features/coaching/characters";
import { styleCoachSpeechForTts } from "@/features/coaching/speechStyle";

/** Latency fallback if the character's preferred model fails. */
const FALLBACK_MODELS = [
  "eleven_multilingual_v2",
  "eleven_turbo_v2_5",
  "eleven_flash_v2_5",
] as const;

const CACHE_DIR = path.join(process.cwd(), ".cache", "tts-elevenlabs");

export function elevenLabsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function cacheKey(character: CoachCharacterId, model: string, text: string): string {
  return createHash("sha256")
    .update(`lab:${character}\0${model}\0${text}`)
    .digest("hex");
}

async function readCache(key: string): Promise<Buffer | null> {
  try {
    return await readFile(path.join(CACHE_DIR, `${key}.mp3`));
  } catch {
    return null;
  }
}

async function writeCache(key: string, buf: Buffer): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(path.join(CACHE_DIR, `${key}.mp3`), buf);
  } catch {
    /* best-effort cache */
  }
}

export async function synthesizeElevenLabsSpeech(
  text: string,
  character: CoachCharacterId,
): Promise<Buffer | null> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) return null;

  const coach = coachCharacterOf(character);
  const line = styleCoachSpeechForTts(text);
  if (!line) return null;

  const models = [
    coach.elevenLabsModelId,
    ...FALLBACK_MODELS.filter((m) => m !== coach.elevenLabsModelId),
  ];

  const voiceId = coach.elevenLabsVoiceId;
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`;
  const settings = coach.elevenLabsSettings;

  for (const model of models) {
    const key = cacheKey(character, model, line);
    const cached = await readCache(key);
    if (cached?.length) return cached;

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: line,
          model_id: model,
          voice_settings: {
            stability: settings.stability,
            similarity_boost: settings.similarity_boost,
            style: settings.style,
            speed: settings.speed,
            use_speaker_boost: settings.use_speaker_boost,
          },
        }),
      });
      if (!res.ok) {
        const detail = await res.text().catch(() => "");
        if (
          res.status === 401 ||
          res.status === 402 ||
          /paid_plan_required|payment_required|free users cannot/i.test(detail)
        ) {
          console.warn(
            "[tts/elevenlabs] Library voices need a paid ElevenLabs plan for API use.",
            "Voice Lab previews work on Free; /v1/text-to-speech does not.",
            "Until upgraded, coach speech falls back to Edge and will not match Voice Lab.",
            { character, model, status: res.status, detail: detail.slice(0, 280) },
          );
          return null;
        }
        console.warn("[tts/elevenlabs]", character, model, res.status, detail.slice(0, 280));
        continue;
      }
      const buf = Buffer.from(await res.arrayBuffer());
      if (!buf.length) continue;
      await writeCache(key, buf);
      return buf;
    } catch (err) {
      console.warn("[tts/elevenlabs]", character, model, err);
    }
  }

  return null;
}
