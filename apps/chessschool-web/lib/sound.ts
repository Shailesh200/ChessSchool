import type { SoundCue } from "@chessschool/design";

const cache = new Map<SoundCue, HTMLAudioElement>();

/** Short vibrations on phones that support them, for the same cues the app gives a haptic. */
const BUZZ: Partial<Record<SoundCue, number | number[]>> = { success: 20, "level-up": [20, 60, 30], stamp: 30, "gentle-no": [15, 40, 15] };

export function playCue(cue: SoundCue, enabled: boolean, haptics = false) {
  if (typeof window === "undefined") return;
  if (haptics && BUZZ[cue] && typeof navigator.vibrate === "function") {
    try {
      navigator.vibrate(BUZZ[cue]);
    } catch {}
  }
  if (!enabled) return;
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
