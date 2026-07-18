import { Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { API_URL, getToken } from "./api";
import { normalizeCoachVoice, type CoachVoiceId } from "./coachVoices";
import { settings } from "./settings";
import { normalizeCoachCharacter, type CoachCharacterId } from "./coachCharacters";

function plainSpeechText(text: string): string {
  return text.replace(/\[[^\]]+\]/g, " ").replace(/\s+/g, " ").trim();
}

type SpeechModule = typeof import("expo-speech");
/** Lazy — dev clients built before expo-speech was added lack the native module. */
let speechJs: SpeechModule | null | undefined;

function getSpeechJs(): SpeechModule | null {
  if (speechJs !== undefined) return speechJs;
  if (Platform.OS === "web") {
    speechJs = null;
    return null;
  }
  try {
    // Dev clients built before expo-speech was linked throw on require — skip fallback gracefully.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    speechJs = require("expo-speech") as SpeechModule;
  } catch {
    speechJs = null;
  }
  return speechJs;
}

const audioCache = new Map<string, string>();
let currentPlayer: AudioPlayer | null = null;
let speakGen = 0;

function cacheKey(text: string, character: CoachCharacterId, voice: CoachVoiceId): string {
  return `${character}|${voice}|${text}`;
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
  character: CoachCharacterId,
  voice: CoachVoiceId,
): Promise<string | null> {
  const resolved = normalizeCoachVoice(voice);
  const key = cacheKey(text, character, resolved);
  const hit = audioCache.get(key);
  if (hit) return hit;

  const token = await getToken();
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (token) headers.authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api/tts`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      text,
      character,
      personality: character,
      voice: resolved,
    }),
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
  try {
    getSpeechJs()?.stop();
  } catch {
    /* ignore */
  }
}

export async function prefetchCoachText(text: string): Promise<void> {
  const s = settings.get();
  if (!s.sound || !s.coachSpeech) return;
  const line = text.trim();
  if (!line || line === "Thinking…") return;
  const voice = normalizeCoachVoice(s.coachVoice);
  const character = normalizeCoachCharacter(s.coachCharacter ?? s.coachPersonality);
  const key = cacheKey(line, character, voice);
  if (audioCache.has(key)) return;
  await fetchCloudAudio(line, character, voice);
}

/** Locale/pitch hints so OS TTS isn't identical when cloud `/api/tts` is unreachable. */
const LOCAL_VOICE: Record<string, { language: string; pitch: number; rate: number }> = {
  auto: { language: "en-US", pitch: 1, rate: 0.95 },
  emma: { language: "en-US", pitch: 1.05, rate: 0.95 },
  aria: { language: "en-US", pitch: 1.1, rate: 1 },
  jane: { language: "en-IE", pitch: 1, rate: 0.95 },
  grant: { language: "en-US", pitch: 0.9, rate: 0.9 },
  sonia: { language: "en-GB", pitch: 1.05, rate: 0.95 },
  natasha: { language: "en-AU", pitch: 1.05, rate: 0.95 },
  neerja: { language: "en-IN", pitch: 1, rate: 0.95 },
  brian: { language: "en-GB", pitch: 0.85, rate: 0.88 },
  guy: { language: "en-US", pitch: 0.95, rate: 0.92 },
  roger: { language: "en-GB", pitch: 0.9, rate: 0.9 },
  ryan: { language: "en-GB", pitch: 1.05, rate: 1 },
  william: { language: "en-AU", pitch: 0.95, rate: 0.92 },
  tony: { language: "en-US", pitch: 1.1, rate: 0.98 },
};

async function speakLocalFallback(text: string, gen: number, voice: CoachVoiceId): Promise<void> {
  const Speech = getSpeechJs();
  if (!Speech || gen !== speakGen) return;
  const profile = LOCAL_VOICE[voice] ?? LOCAL_VOICE.auto!;
  await new Promise<void>((resolve) => {
    Speech.speak(text, {
      language: profile.language,
      pitch: profile.pitch,
      rate: profile.rate,
      onDone: () => resolve(),
      onStopped: () => resolve(),
      onError: () => resolve(),
    });
  });
}

export async function speakCoachText(text: string): Promise<void> {
  const s = settings.get();
  if (!s.sound || !s.coachSpeech) return;
  const line = text.trim();
  if (!line || line === "Thinking…") return;
  // Match web: stop any in-flight clip before fetching the next voice line.
  stopCoachSpeech();
  const gen = speakGen;
  const voice = normalizeCoachVoice(s.coachVoice);
  const character = normalizeCoachCharacter(s.coachCharacter ?? s.coachPersonality);
  const uri = await fetchCloudAudio(line, character, voice);
  if (gen !== speakGen) return;
  // Re-check mute after fetch — mute mid-request must stay silent.
  const after = settings.get();
  if (!after.sound || !after.coachSpeech) return;
  if (!uri) {
    // Cloud TTS carries personality→Edge voice (same as web). Local OS TTS varies by locale.
    await speakLocalFallback(plainSpeechText(line), gen, voice);
    return;
  }
  await playUri(uri, after.volume, gen);
}

