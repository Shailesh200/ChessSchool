import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Piece } from "./Piece";
import { useSettings } from "./settings";

const FALL_MS = 1500;

/**
 * Checkmate beat: loser's king falls using the active piece-theme silhouette,
 * then caller opens “How it happened” after {@link FALL_MS}.
 */
export function KingFallCeremony({
  open,
  loserColor,
  onComplete,
  durationMs = FALL_MS,
}: {
  open: boolean;
  loserColor: "w" | "b";
  onComplete: () => void;
  durationMs?: number;
}) {
  const { pieceTheme } = useSettings();
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!open) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.bezier(0.55, 0.02, 0.75, 0.35),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onComplete, durationMs);
    return () => clearTimeout(t);
  }, [open, durationMs, onComplete, progress]);

  if (!open) return null;

  const tip = loserColor === "w" ? 78 : -78;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={styles.dim} />
      <Animated.View
        style={[
          styles.king,
          {
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.2] }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 72],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${tip}deg`],
                }),
              },
              {
                scale: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1.15, 0.92],
                }),
              },
            ],
          },
        ]}
      >
        <Piece type="k" color={loserColor} size={96} gid="king-fall" themeId={pieceTheme} />
      </Animated.View>
    </View>
  );
}

export const KING_FALL_MS = FALL_MS;

const styles = StyleSheet.create({
  wrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  dim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(20,18,40,0.35)",
    borderRadius: 12,
  },
  king: { width: 96, height: 96, alignItems: "center", justifyContent: "center" },
});
