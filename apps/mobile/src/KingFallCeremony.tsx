import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Piece } from "./Piece";
import { BOARD_THEMES, useSettings } from "./settings";

const CRUSH_MS = 1500;

function squareCell(
  square: string,
  orientation: "white" | "black",
  boardSize: number,
): { left: number; top: number; size: number } {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  const col = orientation === "white" ? file : 7 - file;
  const row = orientation === "white" ? 7 - rank : rank;
  const size = boardSize / 8;
  return { left: col * size, top: row * size, size };
}

function isLightSquare(square: string): boolean {
  const file = square.charCodeAt(0) - 97;
  const rank = Number(square[1]) - 1;
  return (file + rank) % 2 === 1;
}

/**
 * Checkmate beat: crush the mated king on its board square (squash + cracks),
 * then caller opens “How it happened” after {@link CRUSH_MS}.
 */
export function KingFallCeremony({
  open,
  square,
  orientation,
  loserColor,
  boardSize,
  onComplete,
  durationMs = CRUSH_MS,
}: {
  open: boolean;
  square: string | null;
  orientation: "white" | "black";
  loserColor: "w" | "b";
  boardSize: number;
  onComplete: () => void;
  durationMs?: number;
}) {
  const { pieceTheme, boardTheme } = useSettings();
  const progress = useRef(new Animated.Value(0)).current;
  const colors = BOARD_THEMES[boardTheme] ?? BOARD_THEMES.classic;

  useEffect(() => {
    if (!open || !square) {
      progress.setValue(0);
      return;
    }
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: durationMs,
      easing: Easing.bezier(0.22, 0.8, 0.35, 1),
      useNativeDriver: true,
    }).start();
    const t = setTimeout(onComplete, durationMs);
    return () => clearTimeout(t);
  }, [open, square, durationMs, onComplete, progress]);

  const cell = useMemo(
    () => (square ? squareCell(square, orientation, boardSize) : null),
    [square, orientation, boardSize],
  );

  if (!open || !square || !cell) return null;

  const cover = isLightSquare(square) ? colors.light : colors.dark;
  const pieceSize = cell.size * 0.88;
  const crack = loserColor === "w" ? "rgba(30,28,40,0.8)" : "rgba(250,248,255,0.75)";

  // Squash into the square, then settle low — reads as crushed / broken.
  const scaleX = progress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [1, 1.22, 1.28],
  });
  const scaleY = progress.interpolate({
    inputRange: [0, 0.28, 1],
    outputRange: [1, 0.62, 0.42],
  });
  const opacity = progress.interpolate({
    inputRange: [0, 0.35, 1],
    outputRange: [1, 1, 0.45],
  });
  const crackOpacity = progress.interpolate({
    inputRange: [0, 0.22, 0.4, 1],
    outputRange: [0, 0, 1, 0.75],
  });

  return (
    <View style={styles.layer} pointerEvents="none">
      <View
        style={[
          styles.cell,
          {
            left: cell.left,
            top: cell.top,
            width: cell.size,
            height: cell.size,
            backgroundColor: cover,
          },
        ]}
      >
        <Animated.View
          style={{
            opacity,
            transform: [{ scaleX }, { scaleY }],
          }}
        >
          <Piece
            type="k"
            color={loserColor}
            size={pieceSize}
            gid="king-crush"
            themeId={pieceTheme}
          />
        </Animated.View>
        <Animated.View
          style={[StyleSheet.absoluteFillObject, { opacity: crackOpacity }]}
          pointerEvents="none"
        >
          <Svg width="100%" height="100%" viewBox="0 0 100 100">
            <Path
              d="M48 8 L42 38 L55 52 L38 72 L50 94"
              fill="none"
              stroke={crack}
              strokeWidth={2.2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M42 38 L22 48" fill="none" stroke={crack} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M55 52 L78 44" fill="none" stroke={crack} strokeWidth={1.8} strokeLinecap="round" />
            <Path d="M38 72 L18 78" fill="none" stroke={crack} strokeWidth={1.6} strokeLinecap="round" />
          </Svg>
        </Animated.View>
      </View>
    </View>
  );
}

export const KING_FALL_MS = CRUSH_MS;
export const KING_CRUSH_MS = CRUSH_MS;

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
  },
  cell: {
    position: "absolute",
    alignItems: "center",
    justifyContent: "center",
    overflow: "visible",
  },
});
