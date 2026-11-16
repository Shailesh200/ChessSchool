import type { CodyClip, FxAnimation, SoundCue } from "@chessschool/design";

// Metro only bundles statically required files, so every asset is listed here.
export const codySources: Record<CodyClip, object> = {
  idle: require("@chessschool/design/assets/lottie/cody/idle.json"),
  correct: require("@chessschool/design/assets/lottie/cody/correct.json"),
  wrong: require("@chessschool/design/assets/lottie/cody/wrong.json"),
  "lesson-complete": require("@chessschool/design/assets/lottie/cody/lesson-complete.json"),
  "streak-danger": require("@chessschool/design/assets/lottie/cody/streak-danger.json"),
  "streak-saved": require("@chessschool/design/assets/lottie/cody/streak-saved.json"),
  thinking: require("@chessschool/design/assets/lottie/cody/thinking.json"),
  celebrate: require("@chessschool/design/assets/lottie/cody/celebrate.json"),
  sleepy: require("@chessschool/design/assets/lottie/cody/sleepy.json"),
  wave: require("@chessschool/design/assets/lottie/cody/wave.json"),
};

export const fxSources: Record<FxAnimation, object> = {
  "xp-pop": require("@chessschool/design/assets/lottie/fx/xp-pop.json"),
  "streak-spark": require("@chessschool/design/assets/lottie/fx/streak-spark.json"),
  stamp: require("@chessschool/design/assets/lottie/fx/stamp.json"),
  "error-shake": require("@chessschool/design/assets/lottie/fx/error-shake.json"),
  "splash-mark": require("@chessschool/design/assets/lottie/fx/splash-mark.json"),
};

export const soundSources: Record<SoundCue, number> = {
  tap: require("@chessschool/design/assets/sound/tap.wav"),
  success: require("@chessschool/design/assets/sound/success.wav"),
  stamp: require("@chessschool/design/assets/sound/stamp.wav"),
  "gentle-no": require("@chessschool/design/assets/sound/gentle-no.wav"),
  "level-up": require("@chessschool/design/assets/sound/level-up.wav"),
  move: require("@chessschool/design/assets/sound/move.wav"),
  capture: require("@chessschool/design/assets/sound/capture.wav"),
  check: require("@chessschool/design/assets/sound/check.wav"),
  mate: require("@chessschool/design/assets/sound/mate.wav"),
  castle: require("@chessschool/design/assets/sound/castle.wav"),
  promote: require("@chessschool/design/assets/sound/promote.wav"),
  "low-time": require("@chessschool/design/assets/sound/low-time.wav"),
};
