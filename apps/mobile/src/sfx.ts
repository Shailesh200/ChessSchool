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
/** Web voice names mapped to bundled WAVs with per-voice pitch/volume tweaks. */
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

type Voice = { base: BaseSfx; rate?: number; volumeMul?: number };

const VOICE: Record<Sfx, Voice> = {
  move: { base: "move" },
  capture: { base: "capture" },
  select: { base: "select" },
  success: { base: "success" },
  error: { base: "error" },
  win: { base: "win" },
  fail: { base: "error", rate: 0.82 },
  check: { base: "move", rate: 1.38 },
  promotion: { base: "success", rate: 1.12 },
  reward: { base: "success", rate: 1.18 },
  streak: { base: "success", rate: 1.28 },
  levelup: { base: "win", rate: 0.92 },
  unlock: { base: "win", rate: 1.05 },
  exam: { base: "win", rate: 0.84 },
  graduation: { base: "win", rate: 0.78 },
  victory: { base: "win", rate: 0.72 },
  transition: { base: "select", rate: 1.15 },
  notify: { base: "select", rate: 1.42 },
  ambience: { base: "move", rate: 0.68, volumeMul: 0.32 },
};

const players: Partial<Record<BaseSfx, AudioPlayer>> = {};

export const sfx = {
  play(name: Sfx) {
    if (Platform.OS === "web" || !settings.get().sound) return;
    const voice = VOICE[name];
    if (!voice) return;
    try {
      let p = players[voice.base];
      if (!p) {
        p = createAudioPlayer(SOURCES[voice.base]);
        players[voice.base] = p;
      }
      const vol = settings.get().volume * (voice.volumeMul ?? 1);
      p.volume = Math.min(1, Math.max(0, vol));
      if (voice.rate && voice.rate !== 1 && "playbackRate" in p) {
        (p as AudioPlayer & { playbackRate: number }).playbackRate = voice.rate;
      }
      p.seekTo(0);
      p.play();
    } catch {
      /* ignore */
    }
  },
};
