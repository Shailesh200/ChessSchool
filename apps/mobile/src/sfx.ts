import { Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { settings } from "./settings";

// Synthesized sound effects (assets/sounds/*.wav), mirroring the web's audio intents.
const SOURCES = {
  move: require("../assets/sounds/move.wav"),
  capture: require("../assets/sounds/capture.wav"),
  select: require("../assets/sounds/select.wav"),
  success: require("../assets/sounds/success.wav"),
  error: require("../assets/sounds/error.wav"),
  win: require("../assets/sounds/win.wav"),
} as const;
export type Sfx = keyof typeof SOURCES;

const players: Partial<Record<Sfx, AudioPlayer>> = {};

export const sfx = {
  play(name: Sfx) {
    if (Platform.OS === "web" || !settings.get().sound) return;
    try {
      let p = players[name];
      if (!p) {
        p = createAudioPlayer(SOURCES[name]);
        players[name] = p;
      }
      p.volume = settings.get().volume;
      p.seekTo(0);
      p.play();
    } catch {
      /* ignore */
    }
  },
};
