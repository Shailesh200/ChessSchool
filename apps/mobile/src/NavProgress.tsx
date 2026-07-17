import { useEffect, useRef } from "react";
import { Animated, StyleSheet, View } from "react-native";
import { usePathname } from "expo-router";
import { useAppTheme } from "./ThemeProvider";

/** Thin top loading bar — mirrors web NavProgress on route changes. */
export function NavProgress() {
  const pathname = usePathname();
  const { colors, reducedMotion } = useAppTheme();
  const width = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) return;
    width.setValue(0);
    opacity.setValue(1);
    Animated.timing(width, { toValue: 0.72, duration: 280, useNativeDriver: false }).start(() => {
      Animated.timing(width, { toValue: 1, duration: 220, useNativeDriver: false }).start(() => {
        Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: false }).start();
      });
    });
  }, [opacity, pathname, reducedMotion, width]);

  if (reducedMotion) return null;

  return (
    <View style={styles.host} pointerEvents="none">
      <Animated.View
        style={[
          styles.bar,
          {
            backgroundColor: colors.brand,
            opacity,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }),
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  host: { position: "absolute", top: 0, left: 0, right: 0, height: 3, zIndex: 100 },
  bar: { height: 3, borderRadius: 2 },
});
