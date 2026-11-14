"use client";

import { voiceKey } from "@chessschool/design";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { useApp } from "./state";

let audio: HTMLAudioElement | null = null;
const cache = new Map<string, Record<string, string>>();

/** Plays one clip, cutting off whatever the coach was saying. */
export function playClip(url: string, rate = 1) {
  audio ??= new Audio();
  audio.src = url;
  audio.playbackRate = rate;
  void audio.play().catch(() => {});
}

export function stopVoice() {
  audio?.pause();
}

/** The chosen coach's clips for a lesson (empty until recorded, or offline). */
export function useClips(coach: string, lesson: string | null) {
  const id = `${coach}:${lesson}`;
  const [clips, setClips] = useState<Record<string, string> | null>(() => cache.get(id) ?? null);
  useEffect(() => {
    if (!lesson) return;
    const hit = cache.get(id);
    if (hit) return setClips(hit);
    let live = true;
    api
      .voice(coach, lesson)
      .then((r) => {
        cache.set(id, r.clips);
        if (live) setClips(r.clips);
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [id, coach, lesson]);
  return clips;
}

/** `say(text)` plays the coach's recording of that line, when there is one and voice is on. */
export function useCoachVoice(lesson: string | null) {
  const { prefs } = useApp().state;
  const coach = prefs.coach ?? "meera";
  const clips = useClips(coach, prefs.voice ? lesson : null);
  useEffect(() => stopVoice, []);
  return useCallback(
    (text: string) => {
      const url = prefs.voice ? clips?.[voiceKey(text)] : undefined;
      if (url) playClip(url, prefs.voiceSpeed);
    },
    [clips, prefs.voice, prefs.voiceSpeed],
  );
}
