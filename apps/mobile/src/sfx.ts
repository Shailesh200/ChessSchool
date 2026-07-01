import { Platform } from "react-native";
import { createAudioPlayer, type AudioPlayer } from "expo-audio";
import { settings } from "./settings";

const SOURCES = {
  move: require("../assets/sounds/move.wav"),
  capture: require("../assets/sounds/capture.wav"),
  select: require("../assets/sounds/select.wav"),
  success: require("../assets/sounds/success.wav"),
  error: require("../assets/sounds/error.wav"),
  win: require("../assets/sounds/win.wav"),
} as const;

type BaseSfx = keyof typeof SOURCES;
/** Web voice names mapped to bundled WAVs until full synth export lands. */
export type Sfx =
  | BaseSfx
  | "fail"
  | "check"
  | "promotion"
  | "reward"
  | "streak"
  | "levelup"
  | "unlock"
  | "exam"
  | "graduation"
  | "victory"
  | "transition"
  | "notify"
  | "ambience";

const ALIAS: Record<Exclude<Sfx, BaseSfx>, BaseSfx> = {
  fail: "error",
  check: "move",
  promotion: "success",
  reward: "success",
  streak: "success",
  levelup: "win",
  unlock: "win",
  exam: "win",
  graduation: "win",
  victory: "win",
  transition: "select",
  notify: "select",
  ambience: "move",
};

const players: Partial<Record<BaseSfx, AudioPlayer>> = {};

export const sfx = {
  play(name: Sfx) {
    if (Platform.OS === "web" || !settings.get().sound) return;
    const key = (SOURCES as Record<string, unknown>)[name] ? (name as BaseSfx) : ALIAS[name as Exclude<Sfx, BaseSfx>];
    if (!key) return;
    try {
      let p = players[key];
      if (!p) {
        p = createAudioPlayer(SOURCES[key]);
        players[key] = p;
      }
      p.volume = settings.get().volume;
      p.seekTo(0);
      p.play();
    } catch {
      /* ignore */
    }
  },
};
