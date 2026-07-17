import { useEffect, useRef } from "react";
import { Animated, Image, type ImageSourcePropType } from "react-native";
import { useSettings } from "./settings";

export type CodyExpression = "happy" | "think" | "cheer" | "sad" | "wave";

const LOCAL: Record<CodyExpression, ImageSourcePropType> = {
  happy: require("../assets/mascots/cody-happy-v2.png"),
  think: require("../assets/mascots/cody-think-v2.png"),
  cheer: require("../assets/mascots/cody-cheer-v2.png"),
  sad: require("../assets/mascots/cody-sad-v2.png"),
  wave: require("../assets/mascots/cody-wave-v2.png"),
};

/** Cody — bundled mascot with gentle bob (web Mascot parity). */
export function Cody({ expression = "happy", size = 120 }: { expression?: CodyExpression; size?: number }) {
  const { reducedMotion } = useSettings();
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, { toValue: -6, duration: 900, useNativeDriver: true }),
        Animated.timing(bob, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bob, reducedMotion]);

  return (
    <Animated.View style={{ transform: [{ translateY: reducedMotion ? 0 : bob }] }}>
      <Image
        source={LOCAL[expression]}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityLabel={`Cody mascot, ${expression}`}
      />
    </Animated.View>
  );
}
