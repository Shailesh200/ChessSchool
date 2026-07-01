import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { radius } from "./theme";

type Props = {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
};

/** Pulsing placeholder block for skeleton layouts. */
export function ShimmerBox({ width = "100%", height = 16, borderRadius = radius.sm, style }: Props) {
  const { colors, reducedMotion } = useAppTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(0.65);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 750, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 750, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reducedMotion]);

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.surfaceSunken,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** Skeleton layout matching the Learn tab while data loads. */
export function LearnScreenSkeleton() {
  const { colors } = useAppTheme();
  return (
    <View style={sk.wrap}>
      <View style={sk.greeting}>
        <ShimmerBox width={64} height={64} borderRadius={32} />
        <View style={{ flex: 1, gap: 8 }}>
          <ShimmerBox height={22} width="75%" />
          <ShimmerBox height={14} width="95%" />
        </View>
      </View>
      <View style={[sk.card, { backgroundColor: colors.surfaceCard }]}>
        <ShimmerBox height={12} width="55%" />
        <ShimmerBox height={20} width="80%" style={{ marginTop: 10 }} />
        <ShimmerBox height={10} width="100%" style={{ marginTop: 14 }} />
        <ShimmerBox height={44} width={160} borderRadius={radius.pill} style={{ marginTop: 14 }} />
      </View>
      <View style={[sk.card, { backgroundColor: colors.surfaceCard }]}>
        <ShimmerBox height={14} width="40%" />
        <ShimmerBox height={10} width="100%" style={{ marginTop: 12 }} />
      </View>
      <ShimmerBox height={120} borderRadius={radius.card} />
      <ShimmerBox height={80} borderRadius={radius.card} />
    </View>
  );
}

const sk = StyleSheet.create({
  wrap: { gap: 20 },
  greeting: { flexDirection: "row", alignItems: "center", gap: 12 },
  card: { borderRadius: radius.card, padding: 16, gap: 4 },
});
