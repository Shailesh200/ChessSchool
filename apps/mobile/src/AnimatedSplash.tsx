import { useEffect, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { colors, font } from "./theme";

const TOTAL_MS = 2800;

type Props = { onFinish: () => void };

/** Branded splash: Lottie logo bounce + Fredoka tagline lines slide in. */
export function AnimatedSplash({ onFinish }: Props) {
  const line1Y = useRef(new Animated.Value(18)).current;
  const line1O = useRef(new Animated.Value(0)).current;
  const line2Y = useRef(new Animated.Value(18)).current;
  const line2O = useRef(new Animated.Value(0)).current;
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        line1Y.setValue(0);
        line1O.setValue(1);
        line2Y.setValue(0);
        line2O.setValue(1);
        timer = setTimeout(onFinish, 600);
        return;
      }

      lottieRef.current?.play();

      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(line1O, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(line1Y, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(line2O, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          Animated.timing(line2Y, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]),
      ]).start();

      timer = setTimeout(onFinish, TOTAL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [line1O, line1Y, line2O, line2Y, onFinish]);

  return (
    <View style={styles.root}>
      <View style={styles.stack}>
        <LottieView
          ref={lottieRef}
          source={require("../assets/lottie/splash-logo.json")}
          autoPlay={false}
          loop={false}
          style={styles.logo}
        />
        <Animated.Text style={[styles.line1, { opacity: line1O, transform: [{ translateY: line1Y }] }]}>
          Learn chess properly.
        </Animated.Text>
        <Animated.Text style={[styles.line2, { opacity: line2O, transform: [{ translateY: line2Y }] }]}>
          Graduate your game.
        </Animated.Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
  stack: {
    alignItems: "center",
    paddingHorizontal: 32,
  },
  logo: {
    width: 200,
    height: 200,
    marginBottom: 8,
  },
  line1: {
    fontFamily: font.bold,
    fontSize: 26,
    color: colors.ink,
    textAlign: "center",
    letterSpacing: -0.3,
  },
  line2: {
    fontFamily: font.semibold,
    fontSize: 18,
    color: colors.brand,
    textAlign: "center",
    marginTop: 6,
  },
});
