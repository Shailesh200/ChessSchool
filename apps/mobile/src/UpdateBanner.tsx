import { useEffect, useRef } from "react";
import { Animated, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppUpdates } from "./useAppUpdates";
import { useNetwork } from "./NetworkProvider";
import { useAppTheme } from "./ThemeProvider";
import { font, space, type } from "./theme";

/** Prompt to restart when an EAS Update has been downloaded. Sits below NetworkBanner. */
export function UpdateBanner() {
  const { updateReady, applyUpdate } = useAppUpdates();
  const { isConnected, backOnline } = useNetwork();
  const insets = useSafeAreaInsets();
  const { colors, reducedMotion } = useAppTheme();
  const slide = useRef(new Animated.Value(-80)).current;
  const networkVisible = !isConnected || backOnline;
  const topOffset = insets.top + (networkVisible ? 44 : 0) + (Platform.OS === "ios" ? 2 : 4);

  useEffect(() => {
    if (!updateReady) {
      Animated.timing(slide, { toValue: -80, duration: reducedMotion ? 0 : 220, useNativeDriver: true }).start();
      return;
    }
    Animated.spring(slide, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 220 }).start();
  }, [updateReady, slide, reducedMotion]);

  if (!updateReady) return null;

  return (
    <Animated.View style={[styles.wrap, { top: topOffset, transform: [{ translateY: slide }] }]}>
      <Pressable
        style={[styles.banner, { backgroundColor: colors.brand }]}
        onPress={() => void applyUpdate()}
        accessibilityRole="button"
        accessibilityLabel="Restart to apply update"
      >
        <Text style={styles.text} numberOfLines={2}>
          Update ready — tap to restart
        </Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 9998,
    elevation: 9998,
    paddingHorizontal: space[3],
  },
  banner: {
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: space[4],
    alignItems: "center",
  },
  text: {
    ...type.sm,
    fontFamily: font.bold,
    color: "#fff",
    textAlign: "center",
  },
});
