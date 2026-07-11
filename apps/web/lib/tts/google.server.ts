import "server-only";
import { JWT } from "google-auth-library";
import { TTS_MAX_CHARS, TTS_VOICES, COACH_SPEECH_RATE_MULTIPLIER } from "./voices";
import type { CoachPersonality } from "@/core/store/settings.store";

type ServiceAccount = {
  client_email: string;
  private_key: string;
};

let jwtClient: JWT | null = null;

function credentials(): ServiceAccount | null {
  const raw = process.env.GOOGLE_TTS_CREDENTIALS;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ServiceAccount;
  } catch {
    return null;
  }
}

function getJwt(): JWT | null {
  if (jwtClient) return jwtClient;
  const creds = credentials();
  if (!creds?.client_email || !creds?.private_key) return null;
  jwtClient = new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ["https://www.googleapis.com/auth/cloud-platform"],
  });
  return jwtClient;
}

export function googleTtsConfigured(): boolean {
  return Boolean(getJwt());
}

/** Synthesize MP3 via Google Cloud Text-to-Speech (Neural2 / WaveNet). */
export async function synthesizeGoogleSpeech(
  text: string,
  personality: CoachPersonality,
): Promise<Buffer | null> {
  const trimmed = text.trim().slice(0, TTS_MAX_CHARS);
  if (!trimmed) return null;

  const client = getJwt();
  if (!client) return null;

  const voice = TTS_VOICES[personality]?.google ?? TTS_VOICES.friendly.google;
  const token = await client.getAccessToken();
  if (!token) return null;

  const res = await fetch("https://texttospeech.googleapis.com/v1/text:synthesize", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      input: { text: trimmed },
      voice: { languageCode: voice.languageCode, name: voice.name },
      audioConfig: {
        audioEncoding: "MP3",
        speakingRate: Math.min(2.5, voice.speakingRate * COACH_SPEECH_RATE_MULTIPLIER),
        pitch: voice.pitch,
      },
    }),
  });

  if (!res.ok) {
    console.error("Google TTS error", res.status, await res.text().catch(() => ""));
    return null;
  }

  const json = (await res.json()) as { audioContent?: string };
  if (!json.audioContent) return null;
  return Buffer.from(json.audioContent, "base64");
}
