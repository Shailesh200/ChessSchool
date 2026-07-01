import { Image, ImageSourcePropType } from "react-native";

export type CodyExpression = "happy" | "think" | "cheer" | "sad" | "wave";

const LOCAL: Record<CodyExpression, ImageSourcePropType> = {
  happy: require("../assets/mascots/cody-happy-v2.png"),
  think: require("../assets/mascots/cody-think-v2.png"),
  cheer: require("../assets/mascots/cody-cheer-v2.png"),
  sad: require("../assets/mascots/cody-sad-v2.png"),
  wave: require("../assets/mascots/cody-wave-v2.png"),
};

/** Cody — bundled offline mascot art (same PNGs as web /public/mascots). */
export function Cody({ expression = "happy", size = 120 }: { expression?: CodyExpression; size?: number }) {
  return (
    <Image
      source={LOCAL[expression]}
      style={{ width: size, height: size }}
      resizeMode="contain"
      accessibilityLabel={`Cody mascot, ${expression}`}
    />
  );
}
