import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  Image,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import {
  coachCharacterOf,
  type CoachAvatarState,
  type CoachCharacterId,
} from "./coachCharacters";

type Props = {
  character: CoachCharacterId | string;
  state?: CoachAvatarState;
  size?: number;
  style?: ViewStyle;
};

export function CoachAvatar({
  character,
  state = "idle",
  size = 56,
  style,
}: Props) {
  const c = coachCharacterOf(character);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
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
    } else if (state === "speak" || state === "breathe" || state === "success" || state === "signature" || state === "think") {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 400, easing: soft, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 400, easing: soft, useNativeDriver: true }),
        ]),
      );
    } else if (state === "miss") {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1, duration: 80, useNativeDriver: true }),
          Animated.timing(anim, { toValue: -1, duration: 80, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 80, useNativeDriver: true }),
        ]),
      );
    }

    loop?.start();
    return () => {
      loop?.stop();
      anim.stopAnimation();
    };
  }, [state, anim]);

  const transform =
    state === "idle"
      ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }]
      : state === "speak" || state === "breathe"
        ? [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) }]
        : state === "miss"
          ? [
              { translateX: anim.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }) },
              {
                rotate: anim.interpolate({
                  inputRange: [-1, 1],
                  outputRange: ["-3deg", "3deg"],
                }),
              },
            ]
          : state === "think"
            ? [
                { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) },
                {
                  rotate: anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0deg", "-7deg"],
                  }),
                },
              ]
            : state === "success" && c.successMotion === "nod"
              ? [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, 5] }) }]
              : [
                  { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) },
                  { scale: anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] }) },
                ];

  return (
    <View style={[{ width: size, height: size }, style]}>
      {state === "speak" ? (
        <View
          style={[
            StyleSheet.absoluteFillObject,
            {
              borderRadius: size / 2,
              borderWidth: 2,
              borderColor: c.accent,
              opacity: 0.55,
              transform: [{ scale: 1.08 }],
            },
          ]}
        />
      ) : null}
      <Animated.View style={{ width: size, height: size, transform }}>
        <Image
          source={c.image}
          style={{ width: size, height: size, borderRadius: size / 2 }}
          accessibilityLabel={`${c.name}, ${c.theme} coach`}
        />
      </Animated.View>
    </View>
  );
}
