import { useEffect, useMemo, useRef } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { KitButton, KitLogo } from "@/components/kit";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "@/nov2/premiumTokens";

type Props = { onFinish: () => void };

const TOTAL_MS = 2400;

/** Branded illustrated splash — replaces legacy AnimatedSplash when uiLook=premium. */
export function BoaAnimatedSplash({ onFinish }: Props) {
  const line1Y = useRef(new Animated.Value(16)).current;
  const line1O = useRef(new Animated.Value(0)).current;
  const heroScale = useRef(new Animated.Value(0.92)).current;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    void AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (cancelled) return;
      if (reduce) {
        timer = setTimeout(onFinish, 500);
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

  const styles = useMemo(() => makeStyles(), []);

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

function makeStyles() {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: premiumColors.bgSplash },
    inner: { flex: 1, justifyContent: "center", paddingHorizontal: premiumSpace[5], gap: premiumSpace[5] },
    hero: {
      backgroundColor: premiumColors.brandSoft,
      borderRadius: premiumRadius.x2,
      paddingVertical: premiumSpace[10],
      paddingHorizontal: premiumSpace[4],
      alignItems: "center",
    },
    tag: {
      ...premiumType.h2,
      fontFamily: premiumFont.display,
      color: premiumColors.text,
      textAlign: "center",
    },
  });
}
