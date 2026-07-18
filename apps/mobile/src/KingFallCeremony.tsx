import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { Piece } from "./Piece";
import { BOARD_THEMES, useSettings } from "./settings";

const FALL_MS = 1500;

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
 * Checkmate beat: loser's king tips over on its board square, then caller
 * opens “How it happened” after {@link FALL_MS}.
 */
export function KingFallCeremony({
  open,
  square,
  orientation,
  loserColor,
  boardSize,
  onComplete,
  durationMs = FALL_MS,
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
      easing: Easing.bezier(0.45, 0.05, 0.55, 0.95),
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

  const tip = loserColor === "w" ? 72 : -72;
  const cover = isLightSquare(square) ? colors.light : colors.dark;
  const pieceSize = cell.size * 0.88;

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
            opacity: progress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.55] }),
            transform: [
              {
                translateY: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, cell.size * 0.08],
                }),
              },
              {
                rotate: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ["0deg", `${tip}deg`],
                }),
              },
            ],
          }}
        >
          <Piece
            type="k"
            color={loserColor}
            size={pieceSize}
            gid="king-fall"
            themeId={pieceTheme}
          />
        </Animated.View>
      </View>
    </View>
  );
}

export const KING_FALL_MS = FALL_MS;

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
