/** Cody (Storybook × Clay) animation names (files in assets/lottie/cody/<name>.json). */
export const codyAnimations = [
  "idle",
  "wave",
  "happy",
  "giggle",
  "celebrate",
  "thinking",
  "proud",
  "wow",
  "oops",
  "sad-soft",
  "love",
  "sleepy",
  "reading",
] as const;
export type CodyAnimation = (typeof codyAnimations)[number];

/** Frame shown instead of playing when reduced motion is on. */
export const codyPoster: Record<CodyAnimation, number> = {
  idle: 0,
  wave: 32,
  happy: 22,
  giggle: 0,
  celebrate: 40,
  thinking: 40,
  proud: 30,
  wow: 20,
  oops: 30,
  "sad-soft": 40,
  love: 10,
  sleepy: 60,
  reading: 40,
};

export const codyLoops: Record<CodyAnimation, boolean> = {
  idle: true,
  wave: false,
  happy: true,
  giggle: true,
  celebrate: false,
  thinking: true,
  proud: true,
  wow: false,
  oops: true,
  "sad-soft": true,
  love: true,
  sleepy: true,
  reading: true,
};

/** One-shot effects (assets/lottie/fx/<name>.json). */
export const fxAnimations = ["xp-pop", "streak-spark", "stamp", "error-shake", "splash-mark"] as const;
export type FxAnimation = (typeof fxAnimations)[number];

/** Sound cues (assets/sound/<name>.wav). */
export const soundCues = ["tap", "success", "stamp", "gentle-no", "level-up", "move", "capture", "check", "mate", "castle", "promote", "low-time"] as const;
export type SoundCue = (typeof soundCues)[number];

/** Switchable app icons (assets/raster/app-icons/<id>.png, -fg.png, -preview.png). */
export const APP_ICONS = [
  { id: "classroom", name: "Classroom", background: "#E4E2FB" },
  { id: "night", name: "Night", background: "#14152B" },
  { id: "garden", name: "Garden", background: "#7FA36B" },
  { id: "sunset", name: "Sunset", background: "#F08A6A" },
  { id: "ocean", name: "Ocean", background: "#117A8C" },
  { id: "midnight", name: "Midnight", background: "#000000" },
  { id: "library", name: "Library", background: "#7A4A23" },
  { id: "pixel", name: "Pixel", background: "#F6C343" },
] as const;
export type AppIconId = (typeof APP_ICONS)[number]["id"];
/** Native alternate-icon name (PascalCase, as the config plugin registers it). */
export const nativeIconName = (id: string) => `Icon${id[0].toUpperCase()}${id.slice(1)}`;
