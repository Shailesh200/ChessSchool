import { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetwork } from "./NetworkProvider";
import { useAppTheme } from "./ThemeProvider";
import { font, space, type } from "./theme";

/** Top banner — persistent offline + brief "Back online" toast. */
export function NetworkBanner() {
  const { isConnected, backOnline } = useNetwork();
  const insets = useSafeAreaInsets();
  const { colors, reducedMotion } = useAppTheme();
  const slide = useRef(new Animated.Value(-80)).current;
  const visible = !isConnected || backOnline;

  useEffect(() => {
    if (!visible) {
      Animated.timing(slide, { toValue: -80, duration: reducedMotion ? 0 : 220, useNativeDriver: true }).start();
      return;
    }
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [visible, slide, reducedMotion]);

  if (!visible) return null;

  const offline = !isConnected;
  const bg = offline ? colors.ink700 : colors.success600;
  const label = offline ? "You're offline — some features need internet" : "Back online";

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          paddingTop: insets.top + (Platform.OS === "ios" ? 2 : 4),
          transform: [{ translateY: slide }],
        },
      ]}
    >
      <View style={[styles.banner, { backgroundColor: bg }]}>
        <View style={[styles.dot, { backgroundColor: offline ? colors.warning : "#fff" }]} />
        <Text style={styles.text} numberOfLines={2}>
          {label}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    elevation: 9999,
  },
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space[2],
    paddingVertical: 10,
    paddingHorizontal: space[4],
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    ...type.sm,
    fontFamily: font.bold,
    color: "#fff",
    textAlign: "center",
    flexShrink: 1,
  },
});
