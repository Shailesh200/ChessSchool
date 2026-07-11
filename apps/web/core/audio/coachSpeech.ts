"use client";

import { applyCoachLine, type CoachContext } from "@/features/coaching/personality";
import {
  useSettings,
  type CoachPersonality,
  type CoachVoiceId,
} from "@/core/store/settings.store";

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let speakGen = 0;

function cacheKey(
  text: string,
  personality: CoachPersonality,
  voice: CoachVoiceId,
): string {
  return `${voice}:${personality}:${text}`;
}

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.src = "";
    currentAudio = null;
  }
}

function speakWithBrowser(text: string, volume: number) {
  if (typeof window === "undefined" || !window.speechSynthesis) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.volume = Math.min(1, Math.max(0, volume));
  utter.rate = 1;
  window.speechSynthesis.speak(utter);
}

async function fetchCloudAudio(
  text: string,
  personality: CoachPersonality,
  voice: CoachVoiceId,
): Promise<string | null> {
  const key = cacheKey(text, personality, voice);
  const hit = audioCache.get(key);
  if (hit) return hit;

  const res = await fetch("/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, personality, voice }),
  });
  if (!res.ok) return null;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  audioCache.set(key, url);
  if (audioCache.size > 80) {
    const first = audioCache.keys().next().value;
    if (first) {
      const old = audioCache.get(first);
      audioCache.delete(first);
      if (old && old !== url) URL.revokeObjectURL(old);
    }
  }
  return url;
}

function playUrl(url: string, volume: number) {
  stopCurrent();
  const el = new Audio(url);
  el.volume = Math.min(1, Math.max(0, volume));
  currentAudio = el;
  void el.play().catch(() => {});
}

/** Stop any in-flight coach speech (e.g. on unmount). */
export function stopCoachSpeech() {
  speakGen++;
  stopCurrent();
  if (typeof window !== "undefined") window.speechSynthesis?.cancel();
}

/**
 * Speak pre-styled bubble text (no personality pass).
 */
export async function speakCoachText(text: string): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound || !settings.coachSpeech) return;

  const line = text.trim();
  if (!line || line === "Thinking…") return;

  const gen = ++speakGen;
  const url = await fetchCloudAudio(
    line,
    settings.coachPersonality,
    settings.coachVoice,
  );
  if (gen !== speakGen) return;

  if (url) {
    playUrl(url, settings.volume);
    return;
  }
  speakWithBrowser(line, settings.volume);
}

/** Preview a voice from Settings (sample line). */
export async function previewCoachVoice(
  voice: CoachVoiceId,
  sample = "Nice work — keep scanning the board for your next idea.",
): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound) return;

  const gen = ++speakGen;
  const url = await fetchCloudAudio(sample, settings.coachPersonality, voice);
  if (gen !== speakGen) return;

  if (url) {
    playUrl(url, settings.volume);
    return;
  }
  speakWithBrowser(sample, settings.volume);
}

/**
 * Speak coach bubble text via cloud TTS (browser fallback if API unavailable).
 */
export async function speakCoachLine(
  raw: string,
  context: CoachContext,
  personality?: CoachPersonality,
): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound || !settings.coachSpeech) return;

  const text = applyCoachLine(raw, personality ?? settings.coachPersonality, context).trim();
  await speakCoachText(text);
}
