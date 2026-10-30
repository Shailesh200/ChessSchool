import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KitButton, KitLogo, usePremiumKitTheme } from "@/components/kit";
import { useSettings } from "@/settings";
import { resolvePremiumColorMode } from "@/themeMode";
import { createSplashStyles } from "@/nov2/premiumKitStyles";

type Props = { onFinish: () => void };

const TOTAL_MS = 2400;

/** Branded illustrated splash — replaces legacy AnimatedSplash when uiLook=premium. */
export function BoaAnimatedSplash({ onFinish }: Props) {
  const { themeMode } = useSettings();
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createSplashStyles(kit), [kit]);
  const line1Y = useRef(new Animated.Value(16)).current;
  const line1O = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce || process.env.EXPO_PUBLIC_BOA_CAPTURE === "1") {
        timer = setTimeout(onFinish, 200);
        return;
      }
      Animated.parallel([
        Animated.timing(heroScale, { toValue: 1, duration: 520, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.sequence([
          Animated.delay(360),
          Animated.parallel([
            Animated.timing(line1O, { toValue: 1, duration: 420, useNativeDriver: true }),
            Animated.timing(line1Y, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
          ]),
        ]),
      ]).start();
      timer = setTimeout(onFinish, TOTAL_MS);
    });

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [heroScale, line1O, line1Y, onFinish]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.inner}>
        <Animated.View style={[styles.hero, { transform: [{ scale: heroScale }] }]}>
          <KitLogo withText size={32} />
        </Animated.View>
        <Animated.Text style={[styles.tag, { opacity: line1O, transform: [{ translateY: line1Y }] }]}>
          Learn chess with a coach who has your back.
        </Animated.Text>
      </View>
    </SafeAreaView>
  );
}
