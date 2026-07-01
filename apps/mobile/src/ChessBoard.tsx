import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, PanResponder, Pressable, StyleSheet, Text, View } from "react-native";
import Svg, { G, Line, Polygon } from "react-native-svg";
import { ChessEngine } from "@chess-school/core";
import { colors, font, radius, shadowCard, space, type } from "./theme";
import { useSettings, BOARD_THEMES } from "./settings";
import { Piece, type PieceThemeId } from "./Piece";

type PieceType = "p" | "n" | "b" | "r" | "q" | "k";
type Cell = { type: PieceType; color: "w" | "b" } | null;
export type Arrow = { startSquare: string; endSquare: string; color?: string };
type PromotionPiece = "q" | "r" | "b" | "n";

const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"];
const DRAG_ACTIVATION_DISTANCE = 10;
const MOVE_ANIMATION_MS = 480;
const MOVE_EASING = Easing.inOut(Easing.cubic);
const PROMO_GLYPHS: Record<"w" | "b", Record<PromotionPiece, string>> = {
  w: { q: "♕", r: "♖", b: "♗", n: "♘" },
  b: { q: "♛", r: "♜", b: "♝", n: "♞" },
};
function hexToRgba(hex: string, alpha: number) {
  const value = hex.replace("#", "");
  const int = Number.parseInt(value.length === 3 ? value.split("").map((c) => c + c).join("") : value, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
function lastMoveTone(theme: string, move: string) {
  const dark = theme === "neon" || theme === "midnight" || theme === "chalkboard";
  return {
    fill: hexToRgba(move, dark ? 0.2 : 0.14),
    border: hexToRgba(move, dark ? 0.76 : 0.52),
  };
}

/** A piece rendered above the board and animated from source cell to target cell. */
function AnimatedPiece({
  type,
  color,
  size,
  gid,
  themeId,
  from,
  to,
  animKey,
  onDone,
}: {
  type: PieceType;
  color: "w" | "b";
  size: number;
  gid: string;
  themeId: PieceThemeId;
  from: { x: number; y: number };
  to: { x: number; y: number };
  animKey: string;
  onDone?: () => void;
}) {
  const left = useRef(new Animated.Value(from.x)).current;
  const top = useRef(new Animated.Value(from.y)).current;
  useEffect(() => {
    left.setValue(from.x);
    top.setValue(from.y);
    Animated.parallel([
      Animated.timing(left, { toValue: to.x, duration: MOVE_ANIMATION_MS, easing: MOVE_EASING, useNativeDriver: false }),
      Animated.timing(top, { toValue: to.y, duration: MOVE_ANIMATION_MS, easing: MOVE_EASING, useNativeDriver: false }),
    ]).start(({ finished }) => {
      if (finished) onDone?.();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animKey]);
  return (
    <Animated.View style={[styles.movingPiece, { left, top, width: size / 0.86, height: size / 0.86 }]}>
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
function pieceAtBoard(board: Cell[][], sq: string): Cell {
  return board[8 - Number(sq[1])]?.[FILES.indexOf(sq[0]!)] ?? null;
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
  highlightFiles,
  highlightRanks,
  checkSquare,
  successSquare,
  showNotation = false,
}: {
  fen: string;
  size: number;
  orientation?: "white" | "black";
  onMove?: (from: string, to: string, promotion?: PromotionPiece) => boolean;
  interactive?: boolean;
  lastMove?: { from: string; to: string } | null;
  arrows?: Arrow[];
  highlights?: string[];
  /** tint whole files (columns) while teaching */
  highlightFiles?: string[];
  /** tint whole ranks (rows) while teaching */
  highlightRanks?: number[];
  checkSquare?: string | null;
  successSquare?: string | null;
  /** Pre-School: show a–h / 1–8 coordinates on the board edge. */
  showNotation?: boolean;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [promo, setPromo] = useState<{ from: string; to: string; color: "w" | "b" } | null>(null);
  const { boardTheme, pieceTheme, reducedMotion } = useSettings();
  const { light: LIGHT, dark: DARK, move: MOVE } = BOARD_THEMES[boardTheme];
  const lastTone = lastMoveTone(boardTheme, MOVE);
  const selectedTint = hexToRgba(MOVE, 0.38);
  const cell = size / 8;
  const engineRef = useRef(new ChessEngine(fen));
  useEffect(() => {
    engineRef.current = new ChessEngine(fen);
  }, [fen]);
  const [renderFen, setRenderFen] = useState(fen);
  const board = useMemo(() => fenToBoard(renderFen), [renderFen]);
  const currentBoard = useMemo(() => fenToBoard(fen), [fen]);
  const [moveAnim, setMoveAnim] = useState<{
    key: string;
    from: string;
    to: string;
    piece: Exclude<Cell, null>;
  } | null>(null);

  const ranks = orientation === "white" ? [8, 7, 6, 5, 4, 3, 2, 1] : [1, 2, 3, 4, 5, 6, 7, 8];
  const files = orientation === "white" ? FILES : [...FILES].reverse();
  const visPos = (sq: string) => ({ col: files.indexOf(sq[0]!), row: ranks.indexOf(Number(sq[1])) });
  const pieceAt = (sq: string): Cell => pieceAtBoard(board, sq);
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
      for (const m of engineRef.current.legalMoves(selected as never)) {
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
      const moved = tryMove(selected, sq);
      setSelected(moved ? null : piece ? sq : null);
    } else if (piece) {
      setSelected(sq === selected ? null : sq);
    } else {
      setSelected(null);
    }
  }
  function tryMove(from: string, to: string, promotion?: PromotionPiece): boolean {
    if (!onMove) return false;
    if (!promotion) {
      try {
        const engine = engineRef.current;
        const isPromotion = engine.legalMoves(from as never).some((m) => m.to === to && m.promotion);
        if (isPromotion) {
          setPromo({ from, to, color: engine.turn() });
          setSelected(null);
          return false;
        }
      } catch {
        /* invalid source square */
      }
    }
    return onMove(from, to, promotion ?? "q");
  }
  function choosePromotion(piece: PromotionPiece) {
    if (!promo) return;
    tryMove(promo.from, promo.to, piece);
    setPromo(null);
  }
  const tryMoveRef = useRef(tryMove);
  tryMoveRef.current = tryMove;

  // Drag-to-move: a board-level responder handles both a drag (piece follows the
  // finger, drop = move) and a plain tap (no movement → tap-to-select/move).
  const dragRef = useRef<{ from: string; piece: Cell } | null>(null);
  const movedRef = useRef(false);
  const startXYRef = useRef<{ x: number; y: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<string | null>(null);
  const [dragXY, setDragXY] = useState<{ x: number; y: number } | null>(null);

  // Keep the latest closures available to the (stable) PanResponder created once below.
  const sqAtRef = useRef(sqAt);
  const pieceAtRef = useRef(pieceAt);
  const tapRef = useRef(tap);
  const interactiveRef = useRef(interactive);
  sqAtRef.current = sqAt;
  pieceAtRef.current = pieceAt;
  tapRef.current = tap;
  interactiveRef.current = interactive;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        movedRef.current = false;
        const { locationX, locationY } = e.nativeEvent;
        startXYRef.current = { x: locationX, y: locationY };
        const sq = sqAtRef.current(locationX, locationY);
        dragRef.current = sq ? { from: sq, piece: pieceAtRef.current(sq) } : null;
      },
      onPanResponderMove: (e) => {
        const start = startXYRef.current;
        const dx = start ? e.nativeEvent.locationX - start.x : 0;
        const dy = start ? e.nativeEvent.locationY - start.y : 0;
        if (!movedRef.current && Math.hypot(dx, dy) < DRAG_ACTIVATION_DISTANCE) return;
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
          tryMoveRef.current(d.from, target!);
          setSelected(null);
        } else {
          tapRef.current(d.from, d.piece); // treat as a tap
        }
      },
      onPanResponderTerminate: () => {
        dragRef.current = null;
        startXYRef.current = null;
        setDragFrom(null);
        setDragXY(null);
      },
    }),
  ).current;

  const fileSet = useMemo(() => new Set(highlightFiles ?? []), [highlightFiles]);
  const rankSet = useMemo(() => new Set(highlightRanks ?? []), [highlightRanks]);

  const fileRankOverlay = (sq: string): string | null => {
    const onFile = fileSet.has(sq[0]!);
    const onRank = rankSet.has(Number(sq[1]));
    if (onFile && onRank) return "rgba(91,91,214,0.34)";
    if (onFile) return "rgba(91,91,214,0.17)";
    if (onRank) return "rgba(52,211,153,0.17)";
    return null;
  };
  const dragPiece = dragFrom ? pieceAt(dragFrom) : null;
  const animSeq = useRef(0);
  useEffect(() => {
    if (renderFen === fen) return;
    if (!lastMove || reducedMotion) {
      setMoveAnim(null);
      setRenderFen(fen);
      return;
    }
    const piece = pieceAtBoard(board, lastMove.from) ?? pieceAtBoard(currentBoard, lastMove.to);
    animSeq.current += 1;
    setRenderFen(fen);
    setMoveAnim(piece ? { key: `m${animSeq.current}`, from: lastMove.from, to: lastMove.to, piece } : null);
  }, [board, currentBoard, fen, lastMove, reducedMotion, renderFen]);

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
            const isCheck = checkSquare === sq;
            const isSuccess = successSquare === sq;
            const hidden = dragFrom === sq || Boolean(moveAnim && moveAnim.to === sq);
            const showFile = showNotation && rank === (orientation === "white" ? 1 : 8);
            const showRank = showNotation && file === (orientation === "white" ? "a" : "h");
            const coordColor = isLight ? "rgba(28,27,46,0.55)" : "rgba(255,255,255,0.75)";
            const tint = fileRankOverlay(sq);
            return (
              <View
                key={sq}
                testID={`sq-${sq}`}
                style={[
                  { width: cell, height: cell, backgroundColor: isLight ? LIGHT : DARK },
                  styles.sq,
                  isHL && styles.highlight,
                  isCheck && styles.check,
                  isSuccess && styles.success,
                ]}
              >
                {tint ? <View style={[styles.fileRankOverlay, { backgroundColor: tint }]} /> : null}
                {isSel ? <View style={[styles.fileRankOverlay, { backgroundColor: selectedTint }]} /> : null}
                {showRank && (
                  <Text style={[styles.coord, styles.coordRank, { color: coordColor }]}>{rank}</Text>
                )}
                {showFile && (
                  <Text style={[styles.coord, styles.coordFile, { color: coordColor }]}>{file}</Text>
                )}
                {isLast && <View style={[styles.lastMoveOverlay, { backgroundColor: lastTone.fill, borderColor: lastTone.border }]} />}
                {captures.has(sq) && <View style={styles.captureBorder} />}
                {dots.has(sq) && <View style={styles.dot} />}
                {piece && !hidden && <Piece type={piece.type} color={piece.color} size={cell * 0.86} gid={`p${sq}`} themeId={pieceTheme} />}
              </View>
            );
          })}
        </View>
      ))}

      {moveAnim && (
        <AnimatedPiece
          type={moveAnim.piece.type}
          color={moveAnim.piece.color}
          size={cell * 0.86}
          gid={`anim-${moveAnim.key}`}
          themeId={pieceTheme}
          from={{ x: visPos(moveAnim.from).col * cell, y: visPos(moveAnim.from).row * cell }}
          to={{ x: visPos(moveAnim.to).col * cell, y: visPos(moveAnim.to).row * cell }}
          animKey={moveAnim.key}
          onDone={() => setMoveAnim(null)}
        />
      )}

      {/* Floating dragged piece (follows the finger) */}
      {dragPiece && dragXY && (
        <View pointerEvents="none" style={[styles.ghost, { left: dragXY.x - cell * 0.5, top: dragXY.y - cell * 0.5, width: cell, height: cell }]}>
          <Piece type={dragPiece.type} color={dragPiece.color} size={cell * 0.86} gid="drag" themeId={pieceTheme} />
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

      {promo && (
        <View style={styles.promoOverlay} pointerEvents="auto">
          <View style={styles.promoCard}>
            <Text style={styles.promoTitle}>Promote to</Text>
            <View style={styles.promoRow}>
              {(["q", "r", "b", "n"] as const).map((piece) => (
                <Pressable key={piece} style={styles.promoBtn} onPress={() => choosePromotion(piece)}>
                  <Text style={styles.promoGlyph}>{PROMO_GLYPHS[promo.color][piece]}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  board: { borderRadius: 10, overflow: "hidden", ...shadowCard },
  sq: { justifyContent: "center", alignItems: "center" },
  fileRankOverlay: { ...StyleSheet.absoluteFillObject },
  coord: { position: "absolute", fontFamily: font.bold, fontSize: 10, lineHeight: 12 },
  coordRank: { top: 2, left: 3 },
  coordFile: { right: 3, bottom: 1 },
  lastMoveOverlay: { ...StyleSheet.absoluteFillObject, borderWidth: 3, borderRadius: 8 },
  highlight: { borderWidth: 4, borderColor: "rgba(91,91,214,0.7)", borderRadius: 8 },
  check: { borderWidth: 4, borderColor: "rgba(244,63,94,0.85)", borderRadius: 8 },
  success: { backgroundColor: "rgba(34,197,94,0.5)", borderWidth: 4, borderColor: "rgba(34,197,94,0.9)", borderRadius: 8 },
  dot: { position: "absolute", width: 12, height: 12, borderRadius: 6, backgroundColor: "rgba(91,91,214,0.5)" },
  captureBorder: { ...StyleSheet.absoluteFillObject, borderWidth: 4, borderColor: "rgba(244,63,94,0.65)", borderRadius: 8 },
  movingPiece: { position: "absolute", zIndex: 12, justifyContent: "center", alignItems: "center" },
  ghost: { position: "absolute", justifyContent: "center", alignItems: "center", zIndex: 10 },
  promoOverlay: { ...StyleSheet.absoluteFillObject, zIndex: 20, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(28,27,46,0.45)" },
  promoCard: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.hairline, backgroundColor: colors.surfaceCard, padding: space[3], ...shadowCard },
  promoTitle: { ...type.xs, fontFamily: font.bold, color: colors.ink700, textAlign: "center", marginBottom: space[2] },
  promoRow: { flexDirection: "row", gap: space[2] },
  promoBtn: { width: 56, height: 56, borderRadius: radius.card, borderWidth: 2, borderColor: colors.hairline, backgroundColor: colors.surface, justifyContent: "center", alignItems: "center", borderBottomWidth: 4 },
  promoGlyph: { fontSize: 32, color: colors.ink },
});
