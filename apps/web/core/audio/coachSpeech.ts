"use client";

import { applyCoachLine, type CoachContext } from "@/features/coaching/personality";
import { voicePreviewText } from "@/lib/tts/voicePreview";
import {
  normalizeCoachVoice,
  resolveEdgeVoice,
  COACH_SPEECH_RATE_MULTIPLIER,
} from "@/lib/tts/voices";
import {
  useSettings,
  type CoachPersonality,
  type CoachVoiceId,
} from "@/core/store/settings.store";
import {
  coachCharacterOf,
  normalizeCoachCharacter,
  type CoachCharacterId,
} from "@/features/coaching/characters";
import { plainSpeechText } from "@/features/coaching/speechStyle";

const audioCache = new Map<string, string>();
let currentAudio: HTMLAudioElement | null = null;
let speakGen = 0;
/** Dedupes hook-triggered speech when a handler already queued the same line. */
let lastQueuedCoachText = "";

export function coachTextAlreadyQueued(text: string): boolean {
  return lastQueuedCoachText === text.trim();
}

function activeCharacter(settings = useSettings.getState()): CoachCharacterId {
  return normalizeCoachCharacter(
    settings.coachCharacter ?? settings.coachPersonality,
  );
}

function cacheKey(
  text: string,
  character: CoachCharacterId,
  voice: CoachVoiceId,
): string {
  const resolved = normalizeCoachVoice(voice);
  const edge = resolveEdgeVoice(character, resolved);
  return `el:${character}|${edge.name}|${edge.rate}|${character}|${resolved}|${text}`;
}

function stopCurrent() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio.src = "";
    currentAudio = null;
  }
}

function playUrl(url: string, volume: number, gen: number): Promise<void> {
  stopCurrent();
  if (gen !== speakGen) return Promise.resolve();

  const el = new Audio(url);
  el.volume = Math.min(1, Math.max(0, volume));
  currentAudio = el;
  return new Promise((resolve) => {
    const finish = () => {
      if (currentAudio === el) currentAudio = null;
      resolve();
    };
    el.addEventListener("ended", finish, { once: true });
    el.addEventListener("error", finish, { once: true });
    void el.play().catch(finish);
  });
}

function speakWithBrowser(text: string, volume: number, gen: number): Promise<void> {
  if (typeof window === "undefined" || !window.speechSynthesis)
    return Promise.resolve();
  window.speechSynthesis.cancel();
  if (gen !== speakGen) return Promise.resolve();

  const utter = new SpeechSynthesisUtterance(plainSpeechText(text));
  utter.volume = Math.min(1, Math.max(0, volume));
  utter.rate = COACH_SPEECH_RATE_MULTIPLIER;
  return new Promise((resolve) => {
    utter.onend = () => resolve();
    utter.onerror = () => resolve();
    window.speechSynthesis.speak(utter);
  });
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

  const res = await fetch("/api/tts", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, character, personality: character, voice: resolved }),
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

/** Warm the TTS cache so the next speak starts without waiting on the network. */
export async function prefetchCoachText(text: string): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound || !settings.coachSpeech) return;

  const line = text.trim();
  if (!line || line === "Thinking…") return;

  const voice = normalizeCoachVoice(settings.coachVoice);
  const character = activeCharacter(settings);
  const key = cacheKey(line, character, voice);
  if (audioCache.has(key)) return;

  await fetchCloudAudio(line, character, voice);
}

/** Stop any in-flight coach speech (e.g. on unmount or voice switch). */
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

  const voice = normalizeCoachVoice(settings.coachVoice);
  const character = activeCharacter(settings);
  const key = cacheKey(line, character, voice);
  const cached = audioCache.get(key);

  lastQueuedCoachText = line;
  stopCoachSpeech();
  const gen = speakGen;

  if (cached) {
    await playUrl(cached, settings.volume, gen);
    return;
  }

  const url = await fetchCloudAudio(line, character, voice);
  if (gen !== speakGen) return;
  // Re-check mute after the network round-trip — mute mid-fetch must stay silent.
  const after = useSettings.getState();
  if (!after.sound || !after.coachSpeech) return;

  if (url) {
    await playUrl(url, after.volume, gen);
    return;
  }
  await speakWithBrowser(line, after.volume, gen);
}

/** Preview a voice from Settings (sample line). Stops any prior preview first. */
export async function previewCoachVoice(
  voice: CoachVoiceId,
  sample?: string,
): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound) return;

  const character = activeCharacter(settings);
  const line = (sample ?? voicePreviewText(voice, character)).trim();
  if (!line) return;

  stopCoachSpeech();
  const gen = speakGen;
  const resolved = normalizeCoachVoice(voice);
  const url = await fetchCloudAudio(line, character, resolved);
  if (gen !== speakGen) return;

  if (url) {
    await playUrl(url, settings.volume, gen);
    return;
  }
  await speakWithBrowser(line, settings.volume, gen);
}

/** Preview the active (or given) coach character sample line. */
export async function previewCoachCharacter(
  characterId?: CoachCharacterId,
): Promise<void> {
  const settings = useSettings.getState();
  if (!settings.sound) return;

  const character = normalizeCoachCharacter(
    characterId ?? activeCharacter(settings),
  );
  const line = coachCharacterOf(character).previewLine;
  stopCoachSpeech();
  const gen = speakGen;
  const url = await fetchCloudAudio(line, character, "auto");
  if (gen !== speakGen) return;
  if (url) {
    await playUrl(url, settings.volume, gen);
    return;
  }
  await speakWithBrowser(line, settings.volume, gen);
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

  const text = applyCoachLine(
    raw,
    personality ?? activeCharacter(settings),
    context,
  ).trim();
  await speakCoachText(text);
}
