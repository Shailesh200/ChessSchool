import { Component, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Image, StyleSheet, Text, View } from "react-native";
import LottieView from "lottie-react-native";
import { colors, font } from "./theme";

const TOTAL_MS = 2800;

type Props = { onFinish: () => void };

/** Catch Lottie native failures so splash still finishes into the app. */
class SplashVisualBoundary extends Component<
  { children: ReactNode; fallback: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    if (__DEV__) console.warn("[AnimatedSplash] visual failed", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SplashMark() {
  return (
    <Image
      source={require("../assets/splash-icon.png")}
      style={styles.logo}
      resizeMode="contain"
      accessibilityIgnoresInvertColors
    />
  );
}

function SplashLottie({ play, onFail }: { play: boolean; onFail: () => void }) {
  const lottieRef = useRef<LottieView>(null);

  useEffect(() => {
    if (play) lottieRef.current?.play();
  }, [play]);

  return (
    <LottieView
      ref={lottieRef}
      source={require("../assets/lottie/splash-logo.json")}
      autoPlay={false}
      loop={false}
      style={styles.logo}
      onAnimationFailure={() => onFail()}
    />
  );
}

/** Branded splash: Lottie logo (fail-open to static mark) + tagline. */
export function AnimatedSplash({ onFinish }: Props) {
  const line1Y = useRef(new Animated.Value(18)).current;
  const line1O = useRef(new Animated.Value(0)).current;
  const line2Y = useRef(new Animated.Value(18)).current;
  const line2O = useRef(new Animated.Value(0)).current;
  const [playLottie, setPlayLottie] = useState(false);
  const [lottieFailed, setLottieFailed] = useState(false);

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

      setPlayLottie(true);

      Animated.sequence([
        Animated.delay(520),
        Animated.parallel([
          Animated.timing(line1O, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(line1Y, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
        ]),
        Animated.delay(120),
        Animated.parallel([
          Animated.timing(line2O, {
            toValue: 1,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
          Animated.timing(line2Y, {
            toValue: 0,
            duration: 420,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }),
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
        <SplashVisualBoundary fallback={<SplashMark />}>
          {lottieFailed ? (
            <SplashMark />
          ) : (
            <SplashLottie play={playLottie} onFail={() => setLottieFailed(true)} />
          )}
        </SplashVisualBoundary>
        <Animated.Text
          style={[styles.line1, { opacity: line1O, transform: [{ translateY: line1Y }] }]}
        >
          Learn chess properly.
        </Animated.Text>
        <Animated.Text
          style={[styles.line2, { opacity: line2O, transform: [{ translateY: line2Y }] }]}
        >
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
