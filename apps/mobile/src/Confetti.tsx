import { useEffect, useState } from "react";
import { Animated, Dimensions, Easing, StyleSheet, View } from "react-native";
import { colors } from "./theme";

import { useSettings } from "./settings";

const PALETTE = [colors.brand, colors.gold, colors.accent, colors.success, colors.danger, colors.brand300];

/** A lightweight confetti burst for celebrations (lesson complete). Respects reducedMotion. */
export function Confetti({ count = 28 }: { count?: number }) {
  const { reducedMotion } = useSettings();
  const { width, height } = Dimensions.get("window");
  const [pieces] = useState(() =>
    Array.from({ length: count }, (_, i) => ({
      x: Math.random() * width,
      color: PALETTE[i % PALETTE.length],
      size: 6 + Math.random() * 6,
      delay: Math.random() * 500,
      drift: (Math.random() - 0.5) * 140,
      spin: Math.random() * 360 + 360,
      v: new Animated.Value(0),
    })),
  );

  useEffect(() => {
    if (reducedMotion) return;
    const anims = pieces.map((p) =>
      Animated.timing(p.v, { toValue: 1, duration: 1800 + Math.random() * 900, delay: p.delay, easing: Easing.linear, useNativeDriver: true }),
    );
    Animated.parallel(anims).start();
  }, [pieces, reducedMotion]);

  if (reducedMotion) return null;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: "absolute",
            left: p.x,
            top: -20,
            width: p.size,
            height: p.size * 1.4,
            backgroundColor: p.color,
            borderRadius: 2,
            opacity: p.v.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [-20, height + 40] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ["0deg", `${p.spin}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
