"use client";

import { copy, language, voiceKey } from "@chessschool/design";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useApp } from "./state";

/**
 * Coach voice. Each clip gets its own preloaded <audio> element (kept for the lesson, oldest dropped first),
 * so a line starts at once instead of waiting for a fresh download; the browser fetches clips in reading
 * order as soon as the lesson's clip list arrives. Starting a line stops the previous one immediately.
 */
const players = new Map<string, HTMLAudioElement>();
const KEEP = 60;
let current: HTMLAudioElement | null = null;
const cache = new Map<string, Record<string, string>>();
const requests = new Map<string, Promise<Record<string, string>>>();

function element(url: string): HTMLAudioElement {
  let el = players.get(url);
  if (el) {
    // Most recently used goes to the back of the line.
    players.delete(url);
    players.set(url, el);
    return el;
  }
  el = new Audio();
  el.preload = "auto";
  el.src = url;
  players.set(url, el);
  if (players.size > KEEP) {
    const [oldest, old] = players.entries().next().value as [string, HTMLAudioElement];
    if (old !== current) {
      old.removeAttribute("src");
      old.load();
    }
    players.delete(oldest);
  }
  return el;
}

/** Starts downloading clips in the order they will be heard. */
export function prefetchClips(urls: (string | undefined)[]) {
  if (typeof Audio === "undefined") return;
  for (const url of urls) if (url && !players.has(url)) element(url);
}

/** Plays one clip, cutting off whatever the coach was saying. */
export function playClip(url: string, rate = 1) {
  if (typeof Audio === "undefined") return;
  stopVoice();
  const el = element(url);
  current = el;
  try {
    el.currentTime = 0;
  } catch {}
  el.playbackRate = rate;
  void el.play().catch(() => {});
}

export function stopVoice() {
  current?.pause();
  current = null;
}

/** The Settings sample for a coach: their own greeting once recorded, else any line of theirs. */
export function sampleClip(coach: string, clips: Record<string, string> | null): string | undefined {
  if (!clips) return undefined;
  const line = copy.coach.samples[coach];
  return (line ? clips[voiceKey(line)] : undefined) ?? Object.values(clips)[0];
}

function loadManifest(coach: string, lesson: string, id: string): Promise<Record<string, string>> {
  let req = requests.get(id);
  if (!req) {
    req = api
      .voice(coach, lesson)
      .then((r) => {
        cache.set(id, r.clips);
        return r.clips;
      })
      .finally(() => requests.delete(id));
    requests.set(id, req);
  }
  return req;
}

/** The chosen coach's clips for a lesson (empty until recorded, or offline). */
export function useClips(coach: string, lesson: string | null) {
  const id = `${coach}:${language()}:${lesson}`;
  const [clips, setClips] = useState<Record<string, string> | null>(() => cache.get(id) ?? null);
  useEffect(() => {
    if (!lesson) return;
    const hit = cache.get(id);
    if (hit) return setClips(hit);
    let live = true;
    loadManifest(coach, lesson, id)
      .then((c) => live && setClips(c))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, coach, lesson]);
  return clips;
}

/**
 * `say(text)` plays the coach's recording of that line, when there is one and voice is on.
 * `lines` are the lesson's spoken lines in order; their clips are fetched ahead of time.
 */
export function useCoachVoice(lesson: string | null, lines: readonly string[] = []) {
  const { prefs } = useApp().state;
  const coach = prefs.coach ?? "meera";
  const clips = useClips(coach, prefs.voice ? lesson : null);
  useEffect(() => stopVoice, []);
  const order = lines.join("\n");
  useEffect(() => {
    if (!clips) return;
    const ahead = order ? order.split("\n").map((t) => clips[voiceKey(t)]) : [];
    prefetchClips([...ahead, ...Object.values(clips)]);
  }, [clips, order]);
  return useCallback(
    (text: string) => {
      const url = prefs.voice ? clips?.[voiceKey(text)] : undefined;
      if (url) playClip(url, prefs.voiceSpeed);
    },
    [clips, prefs.voice, prefs.voiceSpeed],
  );
}
