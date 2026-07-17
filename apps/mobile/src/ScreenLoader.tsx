import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { Cody } from "./Cody";
import { font, space, type } from "./theme";

type Props = {
  label?: string;
  /** Full-screen centered vs inline compact */
  variant?: "fullscreen" | "inline";
};

/** Branded loader — Cody mascot bounce (no crest/logo duplicate). */
export function ScreenLoader({ label = "Loading…", variant = "inline" }: Props) {
  const { colors, reducedMotion } = useAppTheme();
  const bounce = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bounce, reducedMotion]);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then((rm) => {
      if (rm) bounce.setValue(0);
    });
  }, [bounce]);

  const content = (
    <View style={styles.content}>
      <Animated.View style={{ transform: [{ translateY: bounce }] }}>
        <Cody expression="think" size={variant === "fullscreen" ? 96 : 72} />
      </Animated.View>
      <Text style={[styles.label, { color: colors.ink500 }]}>{label}</Text>
    </View>
  );

  if (variant === "fullscreen") {
    return <View style={[styles.fullscreen, { backgroundColor: colors.surface }]}>{content}</View>;
  }
  return <View style={styles.inlineWrap}>{content}</View>;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center" },
  inlineWrap: { flex: 1, width: "100%", justifyContent: "center", alignItems: "center", minHeight: 200 },
  content: { alignItems: "center", gap: space[2] },
  label: { ...type.sm, fontFamily: font.semibold, marginTop: space[1] },
});
