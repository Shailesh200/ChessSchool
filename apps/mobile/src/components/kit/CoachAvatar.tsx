import { useEffect, useRef } from "react";
import { Animated, Easing, Image, StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import {
  coachCharacterOf,
  type CoachAvatarState,
  type CoachCharacterId,
} from "@/coachCharacters";
import { useAppTheme } from "@/ThemeProvider";
import { usePremiumKitTheme } from "./kitThemeContext";

type Props = {
  character: CoachCharacterId | string;
  state?: CoachAvatarState;
  size?: number;
  style?: ViewStyle;
};

function deepen(hex: string, amount = 0.22): string {
  const n = hex.replace("#", "");
  if (n.length !== 6) return hex;
  const r = Math.max(0, Math.round(parseInt(n.slice(0, 2), 16) * (1 - amount)));
  const g = Math.max(0, Math.round(parseInt(n.slice(2, 4), 16) * (1 - amount)));
  const b = Math.max(0, Math.round(parseInt(n.slice(4, 6), 16) * (1 - amount)));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

/** `.coach-avatar` — glow + radial accent plate (kit bg accents). */
export function KitCoachAvatar({ character, state = "idle", size = 56, style }: Props) {
  const c = coachCharacterOf(character);
  const { colors } = usePremiumKitTheme();
  const { reducedMotion } = useAppTheme();
  const anim = useRef(new Animated.Value(0)).current;
  const tint = c.accent;
  const deep = deepen(tint, 0.28);

  useEffect(() => {
    if (reducedMotion) {
      anim.stopAnimation();
      anim.setValue(0);
      return;
    }
    anim.stopAnimation();
    anim.setValue(0);
    const soft = Easing.inOut(Easing.ease);
    let loop: Animated.CompositeAnimation | null = null;
    if (state === "idle") {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 1400, easing: soft, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 1400, easing: soft, useNativeDriver: true }),
        ]),
      );
    }
    loop?.start();
    return () => loop?.stop();
  }, [state, anim, reducedMotion]);

  const translateY =
    reducedMotion || state !== "idle"
      ? 0
      : anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] });

  const plate = size * 1.15;
  const glow = size * 1.35;

  return (
    <View style={[styles.wrap, { width: glow, height: glow }, style]} accessibilityLabel={`${c.name} coach`}>
      <View
        style={[
          styles.glow,
          {
            width: glow,
            height: glow,
            borderRadius: glow / 2,
            backgroundColor: `${tint}33`,
          },
        ]}
      />
      <LinearGradient
        colors={[colors.coachGlow, `${tint}99`, deep]}
        locations={[0, 0.45, 1]}
        start={{ x: 0.5, y: 0.12 }}
        end={{ x: 0.5, y: 1 }}
        style={{
          width: plate,
          height: plate,
          borderRadius: plate / 2,
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <Animated.View style={{ transform: [{ translateY }] }}>
          {reducedMotion ? (
            <Image source={c.image} style={{ width: size, height: size, resizeMode: "contain" }} />
          ) : state === "speak" || state === "success" ? (
            <Image source={c.image} style={{ width: size, height: size, resizeMode: "contain" }} />
          ) : (
            <Image source={c.image} style={{ width: size, height: size, resizeMode: "contain" }} />
          )}
        </Animated.View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  glow: { position: "absolute" },
});
