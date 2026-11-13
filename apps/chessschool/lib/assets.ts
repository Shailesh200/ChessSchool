import type { CodyAnimation, FxAnimation, SoundCue } from "@chessschool/design";

// Metro only bundles statically required files, so every asset is listed here.
export const codySources: Record<CodyAnimation, object> = {
  idle: require("@chessschool/design/assets/lottie/cody/idle.json"),
  wave: require("@chessschool/design/assets/lottie/cody/wave.json"),
  happy: require("@chessschool/design/assets/lottie/cody/happy.json"),
  giggle: require("@chessschool/design/assets/lottie/cody/giggle.json"),
  celebrate: require("@chessschool/design/assets/lottie/cody/celebrate.json"),
  thinking: require("@chessschool/design/assets/lottie/cody/thinking.json"),
  proud: require("@chessschool/design/assets/lottie/cody/proud.json"),
  wow: require("@chessschool/design/assets/lottie/cody/wow.json"),
  oops: require("@chessschool/design/assets/lottie/cody/oops.json"),
  "sad-soft": require("@chessschool/design/assets/lottie/cody/sad-soft.json"),
  love: require("@chessschool/design/assets/lottie/cody/love.json"),
  sleepy: require("@chessschool/design/assets/lottie/cody/sleepy.json"),
  reading: require("@chessschool/design/assets/lottie/cody/reading.json"),
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
