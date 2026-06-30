import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, StyleSheet, View } from "react-native";
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

  // Visual order: white at bottom → rank 8..1 top-to-bottom; flip for black.
  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const visPos = (sq: string) => ({ col: files.indexOf(sq[0]!), row: ranks.indexOf(Number(sq[1])) });
  const pieceAt = (sq: string): Cell => board[8 - Number(sq[1])]?.[FILES.indexOf(sq[0]!)] ?? null;
  const sqAt = (x: number, y: number): string | null => {
    const col = Math.floor(x / cell);
    const row = Math.floor(y / cell);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    return `${files[col]}${ranks[row]}`;
  };

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

  // Tap-to-move fallback (used when the gesture didn't drag).
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

  // Drag-to-move: a board-level responder handles both a drag (piece follows the
  // finger, drop = move) and a plain tap (no movement → tap-to-select/move).
  const dragRef = useRef<{ from: string; piece: Cell } | null>(null);
  const movedRef = useRef(false);
  const noAnimRef = useRef<string | null>(null); // square a drag just dropped on → don't replay the slide
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);

  // Keep the latest closures available to the (stable) PanResponder created once below.
  const sqAtRef = useRef(sqAt);
  const pieceAtRef = useRef(pieceAt);
  const tapRef = useRef(tap);
  const onMoveRef = useRef(onMove);
  const interactiveRef = useRef(interactive);
  sqAtRef.current = sqAt;
  pieceAtRef.current = pieceAt;
  tapRef.current = tap;
  onMoveRef.current = onMove;
  interactiveRef.current = interactive;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        movedRef.current = false;
        const { locationX, locationY } = e.nativeEvent;
        const sq = sqAtRef.current(locationX, locationY);
        dragRef.current = sq ? { from: sq, piece: pieceAtRef.current(sq) } : null;
      },
      onPanResponderMove: (e) => {
        movedRef.current = true;
        // start the floating ghost only once the finger actually moves (so a tap doesn't flash it)
        if (dragRef.current?.piece && interactiveRef.current) {
          setDragFrom(dragRef.current.from);
          setDragXY({ x: e.nativeEvent.locationX, y: e.nativeEvent.locationY });
        }
      },
      onPanResponderRelease: (e) => {
        const { locationX, locationY } = e.nativeEvent;
        const d = dragRef.current;
        const target = sqAtRef.current(locationX, locationY);
        dragRef.current = null;
        setDragFrom(null);
        setDragXY(null);
        if (!d) return;
        const draggedFar = movedRef.current && target && target !== d.from;
        if (draggedFar && d.piece) {
          noAnimRef.current = target!; // already shown by the drag — skip the slide replay
          onMoveRef.current?.(d.from, target!);
          setSelected(null);
        } else {
          noAnimRef.current = null;
          tapRef.current(d.from, d.piece); // treat as a tap
        }
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        setDragFrom(null);
        setDragXY(null);
      },
    }),
  ).current;

  const dragPiece = dragFrom ? pieceAt(dragFrom) : null;

  return (
    <View style={[styles.board, { width: size, height: size }]} {...(interactive && onMove ? pan.panHandlers : {})}>
      {ranks.map((rank, r) => (
        <View key={rank} style={{ flexDirection: "row" }} pointerEvents="none">
          {files.map((file, f) => {
            const sq = `${file}${rank}`;
            const piece = board[8 - rank]![FILES.indexOf(file)]!;
            const isLight = (r + f) % 2 === 0;
            const isSel = selected === sq;
            const isLast = lastMove && (lastMove.from === sq || lastMove.to === sq);
            const isHL = highlights?.includes(sq);
            const hidden = dragFrom === sq; // piece being dragged is rendered as the floating ghost
            return (
              <View
                key={sq}
                testID={`sq-${sq}`}
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
                  !hidden &&
                  (lastMove && lastMove.to === sq && noAnimRef.current !== sq ? (
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
              </View>
            );
          })}
        </View>
      ))}

      {/* Floating dragged piece (follows the finger) */}
      {dragPiece && dragXY && (
        <View pointerEvents="none" style={[styles.ghost, { left: dragXY.x - cell * 0.6, top: dragXY.y - cell * 0.6, width: cell * 1.2, height: cell * 1.2 }]}>
          <Piece type={dragPiece.type} color={dragPiece.color} size={cell * 1.05} gid="drag" themeId={pieceTheme} />
        </View>
      )}

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
  ghost: { position: "absolute", justifyContent: "center", alignItems: "center", zIndex: 10 },
});
