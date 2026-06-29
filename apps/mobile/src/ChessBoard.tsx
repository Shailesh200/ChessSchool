import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, StyleSheet, View } from "react-native";
import Svg, { G, Line, Polygon } from "react-native-svg";
import { ChessEngine } from "@chess-school/core";
import { colors } from "./theme";
import { useSettings, BOARD_THEMES } from "./settings";
import { Piece, type PieceThemeId } from "./Piece";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Cell = { type: PieceType; color: "w" | "b" } | null;
export type Arrow = { startSquare: string; endSquare: string; color?: string };

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const ZERO = { x: 0, y: 0 };

/** A piece that slides in from `delta` (its previous square) to its current square. */
function AnimatedPiece({ type, color, size, gid, themeId, delta, animKey }: { type: PieceType; color: "w" | "b"; size: number; gid: string; themeId: PieceThemeId; delta: { x: number; y: number }; animKey: string }) {
  const t = useRef(new Animated.ValueXY(delta)).current;
  useEffect(() => {
    t.setValue(delta);
    // Match web (react-chessboard) tween: ~220ms ease-out.
    Animated.timing(t, { toValue: ZERO, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);
  return (
    <Animated.View style={{ transform: t.getTranslateTransform() }}>
      <Piece type={type} color={color} size={size} gid={gid} themeId={themeId} />
    </Animated.View>
  );
}

function fenToBoard(fen: string): Cell[][] {
  return fen
    .split(" ")[0]!
    .split("/")
    .map((row) => {
      const cells: Cell[] = [];
      for (const ch of row) {
        if (/\d/.test(ch)) for (let i = 0; i < Number(ch); i++) cells.push(null);
        else cells.push({ type: ch.toLowerCase() as PieceType, color: ch === ch.toLowerCase() ? "b" : "w" });
      }
      return cells;
    });
}

export function ChessBoard({
  fen,
  size,
  orientation = "white",
  onMove,
  interactive = true,
  lastMove,
  arrows,
  highlights,
}: {
  fen: string;
  size: number;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string) => boolean;
  interactive?: boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  highlights?: string[];
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const { boardTheme, pieceTheme, reducedMotion } = useSettings();
  const { light: LIGHT, dark: DARK } = BOARD_THEMES[boardTheme];
  const cell = size / 8;
  const board = useMemo(() => fenToBoard(fen), [fen]);

  const { dots, captures } = useMemo(() => {
    if (!selected) return { dots: new Set<string>(), captures: new Set<string>() };
    const d = new Set<string>();
    const c = new Set<string>();
    try {
      for (const m of new ChessEngine(fen).legalMoves(selected as never)) {
        if (m.captured || (m.flags && /[ce]/.test(m.flags))) c.add(m.to);
        else d.add(m.to);
      }
    } catch {
      /* none */
    }
    return { dots: d, captures: c };
  }, [selected, fen]);

  // Visual order: white at bottom → rank 8..1 top-to-bottom; flip for black.
  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const visPos = (sq: string) => ({ col: files.indexOf(sq[0]!), row: ranks.indexOf(Number(sq[1])) });

  function tap(sq: string, piece: Cell) {
    if (!interactive || !onMove) return;
    if (selected && sq !== selected) {
      const moved = onMove(selected, sq);
      setSelected(moved ? null : piece ? sq : null);
    } else if (piece) {
      setSelected(sq === selected ? null : sq);
    } else {
      setSelected(null);
    }
  }

  return (
    <View style={[styles.board, { width: size, height: size }]}>
      {ranks.map((rank, r) => (
        <View key={rank} style={{ flexDirection: "row" }}>
          {files.map((file, f) => {
            const sq = `${file}${rank}`;
            const piece = board[8 - rank]![FILES.indexOf(file)]!;
            const isLight = (r + f) % 2 === 0;
            const isSel = selected === sq;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isHL = highlights?.includes(sq);
            return (
              <Pressable
                key={sq}
                testID={`sq-${sq}`}
                onPress={() => tap(sq, piece)}
                style={[
                  { width: cell, height: cell, backgroundColor: isLight ? LIGHT : DARK },
                  styles.sq,
                  isLast && styles.last,
                  isHL && styles.highlight,
                  isSel && styles.selected,
                ]}
              >
                {captures.has(sq) && <View style={[styles.ring, { width: cell * 0.9, height: cell * 0.9, borderRadius: cell }]} />}
                {dots.has(sq) && <View style={styles.dot} />}
                {piece &&
                  (lastMove && lastMove.to === sq ? (
                    <AnimatedPiece
                      type={piece.type}
                      color={piece.color}
                      size={cell * 0.86}
                      gid={`p${sq}`}
                      themeId={pieceTheme}
                      delta={reducedMotion ? ZERO : { x: (visPos(lastMove.from).col - f) * cell, y: (visPos(lastMove.from).row - r) * cell }}
                      animKey={`${lastMove.from}${lastMove.to}`}
                    />
                  ) : (
                    <Piece type={piece.type} color={piece.color} size={cell * 0.86} gid={`p${sq}`} themeId={pieceTheme} />
                  ))}
              </Pressable>
            );
          })}
        </View>
      ))}

      {/* Teaching arrows overlay */}
      {arrows && arrows.length > 0 && (
        <Svg width={size} height={size} style={StyleSheet.absoluteFill} pointerEvents="none">
          {arrows.map((a, i) => {
            const s = visPos(a.startSquare);
            const e = visPos(a.endSquare);
            const sx = (s.col + 0.5) * cell;
            const sy = (s.row + 0.5) * cell;
            const ex = (e.col + 0.5) * cell;
            const ey = (e.row + 0.5) * cell;
            const ang = Math.atan2(ey - sy, ex - sx);
            const head = cell * 0.34;
            const hw = cell * 0.22;
            const bx = ex - Math.cos(ang) * head;
            const by = ey - Math.sin(ang) * head;
            const color = a.color ?? "#34d399";
            const px = Math.cos(ang + Math.PI / 2);
            const py = Math.sin(ang + Math.PI / 2);
            return (
              <G key={i}>
                <Line x1={sx} y1={sy} x2={bx} y2={by} stroke={color} strokeWidth={cell * 0.13} strokeLinecap="round" opacity={0.9} />
                <Polygon points={`${ex},${ey} ${bx + px * hw},${by + py * hw} ${bx - px * hw},${by - py * hw}`} fill={color} opacity={0.9} />
              </G>
            );
          })}
        </Svg>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 10, overflow: "hidden" },
  sq: { justifyContent: "center", alignItems: "center" },
  selected: { backgroundColor: "#7be0b3" },
  last: { backgroundColor: "#ffe08a" },
  highlight: { backgroundColor: "#f6cd56" },
  dot: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(91,91,214,0.5)" },
  ring: { position: "absolute", borderWidth: 4, borderColor: "rgba(244,63,94,0.55)" },
});
