import { Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { API_URL, getToken } from "./api";
import { normalizeCoachVoice, type CoachVoiceId } from "./coachVoices";
import { settings } from "./settings";
import type { CoachPersonality } from "./matchCoach";

const audioCache = new Map<string, string>();
let currentPlayer: AudioPlayer | null = null;
let speakGen = 0;

function cacheKey(text: string, personality: CoachPersonality, voice: CoachVoiceId): string {
  return `${personality}|${voice}|${text}`;
}

function stopCurrent() {
  try {
    currentPlayer?.pause();
    currentPlayer?.remove();
  } catch {
    /* ignore */
  }
  currentPlayer = null;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  return globalThis.btoa(binary);
}

async function fetchCloudAudio(
  text: string,
  personality: CoachPersonality,
  voice: CoachVoiceId,
): Promise<string | null> {
  const resolved = normalizeCoachVoice(voice);
  const key = cacheKey(text, personality, resolved);
  const hit = audioCache.get(key);
  if (hit) return hit;

  const token = await getToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify({ text, personality, voice: resolved }),
  });
  if (!res.ok) return null;

  const uri = `data:audio/mpeg;base64,${arrayBufferToBase64(await res.arrayBuffer())}`;
  audioCache.set(key, uri);
  if (audioCache.size > 48) {
    const first = audioCache.keys().next().value;
    if (first) audioCache.delete(first);
  }
  return uri;
}

async function playUri(uri: string, volume: number, gen: number): Promise<void> {
  stopCurrent();
  if (gen !== speakGen || Platform.OS === "web") return;
  const player = createAudioPlayer({ uri });
  player.volume = Math.min(1, Math.max(0, volume));
  currentPlayer = player;
  player.play();
  await new Promise<void>((resolve) => {
    const done = () => {
      if (currentPlayer === player) currentPlayer = null;
      resolve();
    };
    const sub = player.addListener("playbackStatusUpdate", (status) => {
      if (!status.playing && status.currentTime > 0 && status.duration > 0 && status.currentTime >= status.duration - 0.05) {
        sub.remove();
        done();
      }
    });
    setTimeout(() => {
      sub.remove();
      done();
    }, 30_000);
  });
}

export function stopCoachSpeech(): void {
  speakGen++;
  stopCurrent();
}

export async function prefetchCoachText(text: string): Promise<void> {
  const s = settings.get();
  if (!s.sound || !s.coachSpeech) return;
  const line = text.trim();
  if (!line || line === "Thinking…") return;
  const voice = normalizeCoachVoice(s.coachVoice);
  const key = cacheKey(line, normalizePersonality(s.coachPersonality), voice);
  if (audioCache.has(key)) return;
  await fetchCloudAudio(line, normalizePersonality(s.coachPersonality), voice);
}

export async function speakCoachText(text: string): Promise<void> {
  const s = settings.get();
  if (!s.sound || !s.coachSpeech) return;
  const line = text.trim();
  if (!line || line === "Thinking…") return;
  const gen = ++speakGen;
  const voice = normalizeCoachVoice(s.coachVoice);
  const personality = normalizePersonality(s.coachPersonality);
  const uri = await fetchCloudAudio(line, personality, voice);
  if (!uri || gen !== speakGen) return;
  await playUri(uri, s.volume, gen);
}

function normalizePersonality(id: string): CoachPersonality {
  if (id === "strict" || id === "mentor" || id === "tactical" || id === "minimal") return id;
  return "friendly";
}
