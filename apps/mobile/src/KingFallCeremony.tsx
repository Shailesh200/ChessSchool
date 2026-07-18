import { useEffect, useMemo, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { Piece } from "./Piece";
import { BOARD_THEMES, useSettings } from "./settings";

const CRUSH_MS = 2000;

type Shard = {
  /** Normalized clip rect inside the piece (0–1). */
  left: number;
  top: number;
  width: number;
  height: number;
  tx: number;
  ty: number;
  r: string;
};

const SHARDS: Shard[] = [
  { left: 0, top: 0, width: 0.4, height: 0.5, tx: -14, ty: -10, r: "-20deg" },
  { left: 0.35, top: 0, width: 0.35, height: 0.42, tx: 2, ty: -14, r: "8deg" },
  { left: 0.65, top: 0, width: 0.35, height: 0.48, tx: 14, ty: -8, r: "18deg" },
  { left: 0, top: 0.45, width: 0.42, height: 0.55, tx: -12, ty: 12, r: "-12deg" },
  { left: 0.38, top: 0.38, width: 0.28, height: 0.36, tx: 0, ty: 8, r: "4deg" },
  { left: 0.6, top: 0.4, width: 0.4, height: 0.4, tx: 12, ty: 10, r: "14deg" },
  { left: 0.3, top: 0.68, width: 0.4, height: 0.32, tx: -6, ty: 16, r: "-8deg" },
  { left: 0.55, top: 0.7, width: 0.45, height: 0.3, tx: 10, ty: 18, r: "16deg" },
];

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
 * Checkmate beat: crush the mated king on its board square into shards,
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

  const wholeOpacity = progress.interpolate({
    inputRange: [0, 0.18, 0.28],
    outputRange: [1, 1, 0],
    extrapolate: "clamp",
  });
  const wholeScaleX = progress.interpolate({
    inputRange: [0, 0.22],
    outputRange: [1, 1.2],
    extrapolate: "clamp",
  });
  const wholeScaleY = progress.interpolate({
    inputRange: [0, 0.22],
    outputRange: [1, 0.62],
    extrapolate: "clamp",
  });
  const shardOpacity = progress.interpolate({
    inputRange: [0.16, 0.28, 0.7, 1],
    outputRange: [0, 1, 0.85, 0.4],
    extrapolate: "clamp",
  });
  const crackOpacity = progress.interpolate({
    inputRange: [0, 0.2, 0.35, 1],
    outputRange: [0, 0, 1, 0.7],
    extrapolate: "clamp",
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
        <View style={{ width: pieceSize, height: pieceSize }}>
          <Animated.View
            style={{
              ...StyleSheet.absoluteFillObject,
              opacity: wholeOpacity,
              transform: [{ scaleX: wholeScaleX }, { scaleY: wholeScaleY }],
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Piece
              type="k"
              color={loserColor}
              size={pieceSize}
              gid="king-crush-whole"
              themeId={pieceTheme}
            />
          </Animated.View>

          {SHARDS.map((shard, i) => {
            const w = pieceSize * shard.width;
            const h = pieceSize * shard.height;
            const left = pieceSize * shard.left;
            const top = pieceSize * shard.top;
            return (
              <Animated.View
                key={i}
                style={{
                  position: "absolute",
                  left,
                  top,
                  width: w,
                  height: h,
                  overflow: "hidden",
                  opacity: shardOpacity,
                  transform: [
                    {
                      translateX: progress.interpolate({
                        inputRange: [0.2, 1],
                        outputRange: [0, shard.tx],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      translateY: progress.interpolate({
                        inputRange: [0.2, 1],
                        outputRange: [0, shard.ty],
                        extrapolate: "clamp",
                      }),
                    },
                    {
                      rotate: progress.interpolate({
                        inputRange: [0.2, 1],
                        outputRange: ["0deg", shard.r],
                        extrapolate: "clamp",
                      }),
                    },
                  ],
                }}
              >
                <View style={{ position: "absolute", left: -left, top: -top }}>
                  <Piece
                    type="k"
                    color={loserColor}
                    size={pieceSize}
                    gid={`king-crush-${i}`}
                    themeId={pieceTheme}
                  />
                </View>
              </Animated.View>
            );
          })}

          <Animated.View
            style={[StyleSheet.absoluteFillObject, { opacity: crackOpacity }]}
            pointerEvents="none"
          >
            <Svg width="100%" height="100%" viewBox="0 0 100 100">
              <Path
                d="M50 6 L44 28 L58 40 L36 58 L48 74 L30 92"
                fill="none"
                stroke={crack}
                strokeWidth={2.1}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <Path d="M44 28 L18 34" fill="none" stroke={crack} strokeWidth={1.7} strokeLinecap="round" />
              <Path d="M58 40 L84 32" fill="none" stroke={crack} strokeWidth={1.7} strokeLinecap="round" />
              <Path d="M36 58 L12 66" fill="none" stroke={crack} strokeWidth={1.5} strokeLinecap="round" />
              <Path d="M48 74 L72 70 L88 86" fill="none" stroke={crack} strokeWidth={1.5} strokeLinecap="round" />
              <Path d="M30 92 L8 88" fill="none" stroke={crack} strokeWidth={1.4} strokeLinecap="round" />
            </Svg>
          </Animated.View>
        </View>
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
