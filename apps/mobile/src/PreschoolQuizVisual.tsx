import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { deriveGridHighlights } from "@chess-school/progression";
import { colors, font, radius, shadowCard, space } from "./theme";

const LIGHT = "#f0ede4";
const DARK = "#8b9a6b";
const ACCENT = colors.brand;
const FILE_TINT = "rgba(91,91,214,0.22)";
const RANK_TINT = "rgba(52,211,153,0.22)";
const CROSS_TINT = "rgba(91,91,214,0.38)";

export type PreschoolVisual =
  | "board-grid"
  | "square"
  | "square-path"
  | "files"
  | "ranks"
  | "e-file"
  | "start-ranks"
  | "piece-roster"
  | "royalty"
  | "notation-letters"
  | "notation-capture";

function MiniBoard({
  highlight = [],
  highlightFiles = [],
  highlightRanks = [],
  path,
  size = 200,
  showCoords = true,
}: {
  highlight?: string[];
  highlightFiles?: string[];
  highlightRanks?: number[];
  path?: [string, string];
  size?: number;
  showCoords?: boolean;
}) {
  const pad = showCoords ? 18 : 0;
  const inner = size - pad;
  const cell = inner / 8;
  const files = "abcdefgh";
  const ranks = [8, 7, 6, 5, 4, 3, 2, 1];
  const hl = new Set(highlight);
  const fileSet = new Set(highlightFiles);
  const rankSet = new Set(highlightRanks);

  const sqFill = (sq: string, light: boolean) => {
    if (hl.has(sq)) return ACCENT;
    if (path?.includes(sq)) return colors.success;
    return light ? LIGHT : DARK;
  };

  const fileRankOverlay = (sq: string): string | null => {
    const onFile = fileSet.has(sq[0]!);
    const onRank = rankSet.has(Number(sq[1]));
    if (onFile && onRank) return CROSS_TINT;
    if (onFile) return FILE_TINT;
    if (onRank) return RANK_TINT;
    return null;
  };

  return (
    <View style={{ width: size, height: size }}>
      {showCoords &&
        ranks.map((rank, ri) => (
          <Text key={`r-${rank}`} style={[styles.coordSide, { top: pad + ri * cell + cell * 0.28, left: 2 }]}>
            {rank}
          </Text>
        ))}
      {showCoords &&
        files.split("").map((file, fi) => (
          <Text
            key={`f-${file}`}
            style={[styles.coordBottom, { left: pad + fi * cell + cell * 0.32, bottom: 0, color: fileSet.has(file) ? ACCENT : colors.ink500 }]}
          >
            {file}
          </Text>
        ))}
      <View style={{ position: "absolute", left: pad, top: pad, width: inner, height: inner, flexDirection: "row", flexWrap: "wrap" }}>
        {ranks.map((rank, ri) =>
          files.split("").map((file, fi) => {
            const sq = `${file}${rank}`;
            const light = (fi + ri) % 2 === 0;
            const isHl = hl.has(sq);
            const tint = fileRankOverlay(sq);
            return (
              <View
                key={sq}
                style={{
                  width: cell,
                  height: cell,
                  backgroundColor: sqFill(sq, light),
                  alignItems: "center",
                  justifyContent: "center",
                  borderWidth: isHl ? 2 : 0,
                  borderColor: "#fff",
                }}
              >
                {tint ? <View style={[StyleSheet.absoluteFillObject, { backgroundColor: tint }]} /> : null}
                {isHl && <Text style={{ color: "#fff", fontFamily: font.bold, fontSize: cell * 0.34 }}>{sq}</Text>}
              </View>
            );
          }),
        )}
      </View>
    </View>
  );
}

const PIECES = [
  { emoji: "♟️", name: "Pawn" },
  { emoji: "♜", name: "Rook" },
  { emoji: "♞", name: "Knight" },
  { emoji: "♝", name: "Bishop" },
  { emoji: "♛", name: "Queen" },
  { emoji: "♚", name: "King" },
];

export function PreschoolQuizVisual({
  visual = "board-grid",
  visualSquare,
  visualSquares,
}: {
  visual?: PreschoolVisual;
  visualSquare?: string;
  visualSquares?: [string, string];
}) {
  const pulse = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.04, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  const grid = deriveGridHighlights({ visualSquare, visualSquares: visualSquares ? [...visualSquares] : undefined });

  return (
    <View style={styles.wrap}>
      {visual === "board-grid" && (
        <MiniBoard highlight={["h1", "a8"]} highlightFiles={["h"]} highlightRanks={[1, 8]} showCoords />
      )}
      {visual === "square" && visualSquare && (
        <MiniBoard highlight={[visualSquare]} highlightFiles={grid.highlightFiles} highlightRanks={grid.highlightRanks} showCoords />
      )}
      {visual === "square-path" && visualSquares && (
        <MiniBoard
          highlight={[...visualSquares]}
          highlightFiles={grid.highlightFiles}
          highlightRanks={grid.highlightRanks}
          path={visualSquares}
          showCoords
        />
      )}
      {visual === "files" && (
        <View style={styles.row}>
          {"abcdefgh".split("").map((f) => (
            <View key={f} style={[styles.fileCol, f === "e" && styles.fileColHot]}>
              <Text style={[styles.fileLabel, f === "e" && styles.fileLabelHot]}>{f}</Text>
            </View>
          ))}
        </View>
      )}
      {visual === "e-file" && (
        <View style={styles.center}>
          <View style={styles.row}>
            {"abcdefgh".split("").map((f) => (
              <View key={f} style={[styles.fileCol, f === "e" && styles.fileColHot]}>
                <Text style={[styles.fileLabel, f === "e" && styles.fileLabelHot]}>{f}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.caption}>Kings start on the e-file</Text>
        </View>
      )}
      {(visual === "ranks" || visual === "start-ranks") && (
        <View style={{ gap: space[1] }}>
          {[8, 7, 6, 5, 4, 3, 2, 1].map((r) => (
            <View key={r} style={[styles.rankRow, r <= 2 && styles.rankRowHot]}>
              <Text style={styles.rankNum}>#{r}</Text>
              <Text style={styles.rankLabel}>rank {r}</Text>
            </View>
          ))}
        </View>
      )}
      {visual === "piece-roster" && (
        <View style={styles.pieceGrid}>
          {PIECES.map((p) => (
            <View key={p.name} style={styles.pieceCard}>
              <Text style={styles.pieceEmoji}>{p.emoji}</Text>
              <Text style={styles.pieceName}>{p.name}</Text>
            </View>
          ))}
        </View>
      )}
      {visual === "royalty" && (
        <Animated.View style={[styles.royalty, { transform: [{ scale: pulse }] }]}>
          <View style={styles.royalItem}>
            <Text style={styles.royalEmoji}>♛</Text>
            <Text style={styles.royalCap}>Most powerful</Text>
          </View>
          <View style={styles.royalItem}>
            <Text style={styles.royalEmoji}>♚</Text>
            <Text style={[styles.royalCap, { color: colors.brand }]}>Most important</Text>
          </View>
        </Animated.View>
      )}
      {visual === "notation-letters" && (
        <View style={styles.letterRow}>
          {[
            ["K", "King"],
            ["Q", "Queen"],
            ["R", "Rook"],
            ["B", "Bishop"],
            ["N", "Knight"],
          ].map(([letter, name]) => (
            <View key={letter} style={styles.letterCard}>
              <Text style={styles.letter}>{letter}</Text>
              <Text style={styles.letterName}>{name}</Text>
            </View>
          ))}
        </View>
      )}
      {visual === "notation-capture" && (
        <View style={styles.center}>
          <Text style={styles.notationBig}>
            e<Text style={{ color: colors.danger }}>x</Text>d5
          </Text>
          <MiniBoard size={160} highlight={["e4", "d5"]} highlightFiles={["e", "d"]} highlightRanks={[4, 5]} path={["e4", "d5"]} showCoords />
          <Text style={styles.caption}>e-file pawn captures on d5</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    minHeight: 176,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.hairline,
    backgroundColor: colors.surfaceCard,
    padding: space[4],
    alignItems: "center",
    justifyContent: "center",
    ...shadowCard,
  },
  row: { flexDirection: "row", gap: space[1] },
  fileCol: {
    width: 28,
    height: 112,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: space[1],
  },
  fileColHot: { backgroundColor: colors.brand },
  fileLabel: { fontFamily: font.bold, fontSize: 12, color: colors.ink700 },
  fileLabelHot: { color: "#fff" },
  rankRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space[2],
    width: 168,
    height: 28,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
    paddingHorizontal: space[2],
  },
  rankRowHot: { backgroundColor: colors.brand50 },
  rankNum: { fontFamily: font.bold, fontSize: 10, color: colors.ink500, width: 18 },
  rankLabel: { fontFamily: font.bold, fontSize: 12, color: colors.ink700 },
  pieceGrid: { flexDirection: "row", flexWrap: "wrap", gap: space[2], justifyContent: "center", maxWidth: 240 },
  pieceCard: {
    width: 72,
    alignItems: "center",
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    paddingVertical: space[2],
  },
  pieceEmoji: { fontSize: 28 },
  pieceName: { fontFamily: font.bold, fontSize: 10, color: colors.ink700, marginTop: 2 },
  royalty: { flexDirection: "row", gap: space[6], alignItems: "flex-end" },
  royalItem: { alignItems: "center" },
  royalEmoji: { fontSize: 44 },
  royalCap: { fontFamily: font.bold, fontSize: 11, color: colors.ink700, marginTop: space[1] },
  letterRow: { flexDirection: "row", flexWrap: "wrap", gap: space[2], justifyContent: "center" },
  letterCard: {
    width: 52,
    height: 52,
    borderRadius: radius.card,
    backgroundColor: colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  letter: { fontFamily: font.bold, fontSize: 20, color: "#fff" },
  letterName: { fontFamily: font.bold, fontSize: 7, color: "rgba(255,255,255,0.85)" },
  notationBig: { fontFamily: font.bold, fontSize: 28, color: colors.ink, marginBottom: space[2] },
  center: { alignItems: "center", gap: space[2] },
  caption: { fontFamily: font.bold, fontSize: 11, color: colors.ink500 },
  coordSide: { position: "absolute", fontFamily: font.bold, fontSize: 10, color: colors.ink500 },
  coordBottom: { position: "absolute", fontFamily: font.bold, fontSize: 10 },
});
