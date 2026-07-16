import { useEffect, useRef, useState } from "react";
import { Animated, Text, type TextProps } from "react-native";
import { useSettings } from "./settings";

/** Count-up number for streak/level/stat tiles (web AnimatedNumber parity). */
export function AnimatedNumber({
  value,
  style,
  duration = 600,
}: {
  value: number;
  style?: TextProps["style"];
  duration?: number;
}) {
  const { reducedMotion } = useSettings();
  const anim = useRef(new Animated.Value(value)).current;
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (reducedMotion) {
      setDisplay(value);
      anim.setValue(value);
      return;
    }
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, { toValue: value, duration, useNativeDriver: false }).start();
    return () => anim.removeListener(id);
  }, [anim, duration, reducedMotion, value]);

  return <Text style={style}>{display}</Text>;
}
