import type { SoundCue } from "@chessschool/design";

const cache = new Map<SoundCue, HTMLAudioElement>();

export function playCue(cue: SoundCue, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  let el = cache.get(cue);
  if (!el) {
    el = new Audio(`/assets/sound/${cue}.wav`);
    el.preload = "auto";
    el.volume = 0.6;
    cache.set(cue, el);
  }
  el.currentTime = 0;
  void el.play().catch(() => {});
}
