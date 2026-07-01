import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { useAppTheme } from "./ThemeProvider";
import { Cody } from "./Cody";
import { font, space, type } from "./theme";

type Props = {
  label?: string;
  /** Full-screen centered vs inline compact */
  variant?: "fullscreen" | "inline";
};

/** Branded loader — Lottie logo + Cody mascot bounce. */
export function ScreenLoader({ label = "Loading…", variant = "inline" }: Props) {
  const { colors, reducedMotion } = useAppTheme();
  const bounce = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    if (reducedMotion) return;
    lottieRef.current?.play();
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
    <View style={variant === "fullscreen" ? styles.full : styles.inline}>
      {!reducedMotion ? (
        <LottieView
          ref={lottieRef}
          source={require("../assets/lottie/splash-logo.json")}
          autoPlay={false}
          loop
          style={styles.lottie}
        />
      ) : null}
      <Animated.View style={{ transform: [{ translateY: bounce }] }}>
        <Cody expression="think" size={variant === "fullscreen" ? 96 : 72} />
      </Animated.View>
      <Text style={[styles.label, { color: colors.ink500 }]}>{label}</Text>
    </View>
  );

  if (variant === "fullscreen") {
    return <View style={[styles.fullscreen, { backgroundColor: colors.surface }]}>{content}</View>;
  }
  return content;
}

const styles = StyleSheet.create({
  fullscreen: { flex: 1, justifyContent: "center", alignItems: "center" },
  full: { alignItems: "center", gap: space[2], paddingVertical: space[8] },
  inline: { alignItems: "center", gap: space[2], paddingVertical: space[6] },
  lottie: { width: 56, height: 56, marginBottom: -space[2] },
  label: { ...type.sm, fontFamily: font.semibold, marginTop: space[1] },
});
