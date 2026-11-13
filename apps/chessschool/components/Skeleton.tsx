import { copy } from "@chessschool/design";
import { useEffect, useRef } from "react";
import { Animated, View, type ViewStyle } from "react-native";
import { useTheme } from "@/lib/theme";

function Bar({ style }: { style?: ViewStyle }) {
  const { c } = useTheme();
  const opacity = useRef(new Animated.Value(0.45)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View accessibilityElementsHidden style={[{ backgroundColor: c.sunken, borderRadius: 18, opacity }, style]} />;
}

export function CourseSkeleton() {
  return (
    <View accessibilityLabel={copy.today.focus.loading} accessibilityState={{ busy: true }} style={{ gap: 12 }}>
      <Bar style={{ height: 16, width: "55%" }} />
      <Bar style={{ height: 120 }} />
      <Bar style={{ height: 72, width: "92%" }} />
      <Bar style={{ height: 72, width: "92%" }} />
    </View>
  );
}

export function LessonSkeleton() {
  return (
    <View accessibilityLabel={copy.today.focus.loading} accessibilityState={{ busy: true }} style={{ gap: 12, padding: 16 }}>
      <Bar style={{ height: 16, width: "40%" }} />
      <Bar style={{ aspectRatio: 1, width: "100%" }} />
      <Bar style={{ height: 88 }} />
    </View>
  );
}
