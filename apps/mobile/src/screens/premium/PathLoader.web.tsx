import { Image } from "react-native";

const loaderArt = require("../../../assets/kit/lottie/loader.png");

/** Web has no dotlottie peer. The still is the design's reduced-motion frame. */
export function PathLoader() {
  return <Image source={loaderArt} style={{ width: 72, height: 84 }} accessibilityIgnoresInvertColors />;
}
