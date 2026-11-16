/** Chaukor, the mascot (files in assets/lottie/cody/<name>.json; the component keeps the name Cody). */
export const codyAnimations = ["idle", "correct", "wrong", "lesson-complete", "streak-danger", "streak-saved", "thinking", "celebrate", "sleepy", "wave"] as const;
export type CodyClip = (typeof codyAnimations)[number];

/** Older pose names, kept so existing call sites play the closest new clip. */
export const codyAliases = {
  happy: "correct",
  giggle: "correct",
  love: "correct",
  oops: "wrong",
  "sad-soft": "streak-danger",
  proud: "lesson-complete",
  wow: "celebrate",
  reading: "thinking",
} as const satisfies Record<string, CodyClip>;
export type CodyAnimation = CodyClip | keyof typeof codyAliases;

export const codyClip = (name: CodyAnimation): CodyClip => (name in codyAliases ? codyAliases[name as keyof typeof codyAliases] : (name as CodyClip));

/** Frame shown instead of playing when reduced motion is on (eyes open, readable pose). */
export const codyPoster: Record<CodyClip, number> = {
  idle: 0,
  correct: 62,
  wrong: 30,
  "lesson-complete": 10,
  "streak-danger": 40,
  "streak-saved": 112,
  thinking: 40,
  celebrate: 114,
  sleepy: 0,
  wave: 50,
};

/** Looping clips; the rest play once and then settle back to idle. */
export const codyLoops: Record<CodyClip, boolean> = {
  idle: true,
  correct: false,
  wrong: false,
  "lesson-complete": false,
  "streak-danger": true,
  "streak-saved": false,
  thinking: true,
  celebrate: false,
  sleepy: true,
  wave: false,
};

/** Evening (18:00 local or later) with today's goal not met yet: the streak card shows streak-danger. */
export const streakAtRisk = (doneToday: boolean, streak: number, now: Date = new Date()) => !doneToday && streak > 0 && now.getHours() >= 18;

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
