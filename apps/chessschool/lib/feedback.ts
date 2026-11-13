import type { SoundCue } from "@chessschool/design";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import * as Haptics from "expo-haptics";
import { soundSources } from "./assets";

const players = new Map<SoundCue, AudioPlayer>();
let modeSet = false;

export function playSound(cue: SoundCue) {
  try {
    if (!modeSet) {
      modeSet = true;
      // Respect the silent switch; never interrupt the learner's music.
      void setAudioModeAsync({ playsInSilentMode: false, interruptionMode: "mixWithOthers" }).catch(() => {});
    }
    let p = players.get(cue);
    if (!p) {
      p = createAudioPlayer(soundSources[cue]);
      p.volume = 0.6;
      players.set(cue, p);
    }
    void p.seekTo(0);
    p.play();
  } catch {}
}

const HAPTIC: Partial<Record<SoundCue, () => Promise<void>>> = {
  tap: () => Haptics.selectionAsync(),
  success: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  stamp: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  "level-up": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  "gentle-no": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
  move: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  capture: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  check: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  mate: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  castle: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  promote: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  "low-time": () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning),
};

export function feedback(cue: SoundCue, { sound, haptics }: { sound: boolean; haptics: boolean }) {
  if (sound) playSound(cue);
  if (haptics) void HAPTIC[cue]?.().catch(() => {});
}
