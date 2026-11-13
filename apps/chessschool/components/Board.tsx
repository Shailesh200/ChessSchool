import {
  arrowShape,
  boardSquares,
  fileIndex,
  isPieceSet,
  moveEffects,
  pieceArtwork,
  promotionColumn,
  rankIndex,
  readFen,
  squareLabel,
  turnOf,
  type BoardArrow,
  type Color,
  type MoveRef,
  type Piece,
  type PieceOp,
  type PieceSetId,
  type PromotionPiece,
  type Square,
} from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { memo, useEffect, useMemo, useState } from "react";
import { Image, PixelRatio, Pressable, Text, View, type LayoutChangeEvent } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  ZoomIn,
} from "react-native-reanimated";
import Svg, { Circle, Ellipse, Line, Path, Polygon } from "react-native-svg";
import { useReducedMotion } from "@/lib/hooks";
import { PIECE_PNGS } from "@/lib/pieceAssets";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

function renderOp(op: PieceOp, key: number, tint?: string) {
  const fill = tint ? (op.fill === "none" ? "none" : tint) : (op.fill ?? "#000");
  const stroke = tint && op.stroke ? tint : op.stroke;
  if (op.t === "circle") return <Circle key={key} cx={op.cx} cy={op.cy} r={op.r} fill={fill} stroke={stroke} strokeWidth={op.sw} />;
  if (op.t === "ellipse") return <Ellipse key={key} cx={op.cx} cy={op.cy} rx={op.rx} ry={op.ry} fill={fill} stroke={stroke} strokeWidth={op.sw} />;
  return (
    <Path
      key={key}
      d={op.d}
      fill={fill}
      stroke={stroke}
      strokeWidth={op.sw}
      strokeLinejoin={op.lj as "round" | undefined}
      strokeLinecap={op.lc as "round" | undefined}
      fillOpacity={tint ? 1 : op.fo}
      fillRule={op.fr as "evenodd" | undefined}
    />
  );
}

/** One piece in the chosen set (the learner's set unless `set` is given). `tint` draws a solid silhouette. */
export const PieceArt = memo(function PieceArt({ piece, size, set, tint }: { piece: Piece; size: number; set?: PieceSetId; tint?: string }) {
  const { state } = useApp();
  const chosen = set ?? (isPieceSet(state.prefs.pieceSet) ? state.prefs.pieceSet : "toy");
  const art = pieceArtwork(chosen, piece.color, piece.type);
  if (art.kind === "asset") {
    return <Image source={PIECE_PNGS[art.asset]} style={{ width: size, height: size, tintColor: tint }} resizeMode="contain" />;
  }
  const d = art.drawing;
  return (
    <Svg width={size} height={size} viewBox={d.viewBox}>
      {d.ops.map((op, i) => renderOp(op, i, tint))}
    </Svg>
  );
});

/** The last-moved piece glides in from its starting square. */
function SlidingPiece({ piece, size, dx, dy, pop }: { piece: Piece; size: number; dx: number; dy: number; pop?: boolean }) {
  const t = useSharedValue(1);
  const s = useSharedValue(pop ? 0.4 : 1);
  useEffect(() => {
    t.value = withTiming(0, { duration: 210, easing: Easing.out(Easing.cubic) });
    if (pop) s.value = withDelay(160, withSpring(1, { damping: 9, stiffness: 220 }));
  }, [t, s, pop]);
  const style = useAnimatedStyle(() => ({
    transform: [{ translateX: t.value * dx }, { translateY: t.value * dy }, { scale: s.value }],
  }));
  return (
    <Animated.View pointerEvents="none" style={[{ zIndex: 3 }, style]}>
      <PieceArt piece={piece} size={size} />
    </Animated.View>
  );
}

/** A pulsing red ring under a king in check. */
function CheckGlow({ color, reduced }: { color: string; reduced: boolean }) {
  const p = useSharedValue(0);
  useEffect(() => {
    if (!reduced) p.value = withRepeat(withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }), -1, true);
  }, [p, reduced]);
  const style = useAnimatedStyle(() => ({ opacity: 0.65 + p.value * 0.35, transform: [{ scale: 0.82 + p.value * 0.16 }] }));
  return <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: "4%", borderRadius: 999, backgroundColor: color }, style]} />;
}

/** The taken piece flashes as a silhouette, lifts off and fades, with a small burst. */
function CaptureBurst({ piece, size, x, y, tint, spark, fly }: { piece: Piece; size: number; x: number; y: number; tint: string; spark: string; fly: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const ghost = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateY: t.value * size * 2.2 * fly }, { rotate: `${t.value * 18 * fly}deg` }, { scale: 1 - t.value * 0.35 }],
  }));
  const dots = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);
  return (
    <View pointerEvents="none" style={{ position: "absolute", left: x, top: y, width: size, height: size, alignItems: "center", justifyContent: "center", zIndex: 6 }}>
      {dots.map((a, i) => (
        <Spark key={i} t={t} angle={a} dist={size * 0.62} color={spark} />
      ))}
      <Animated.View style={ghost}>
        <PieceArt piece={piece} size={size * 0.86} tint={tint} />
      </Animated.View>
    </View>
  );
}

function Spark({ t, angle, dist, color }: { t: { value: number }; angle: number; dist: number; color: string }) {
  const style = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: Math.cos(angle) * dist * t.value }, { translateY: Math.sin(angle) * dist * t.value }, { scale: 1 - t.value * 0.6 }],
  }));
  return <Animated.View style={[{ position: "absolute", width: 7, height: 7, borderRadius: 4, backgroundColor: color }, style]} />;
}

/** A gold ring that opens out from a square (promotion). */
function RingFlash({ size, x, y, color }: { size: number; x: number; y: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 700, easing: Easing.out(Easing.quad) });
  }, [t]);
  const style = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 0.6 + t.value * 1.4 }] }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: "absolute", left: x, top: y, width: size, height: size, borderRadius: 999, borderWidth: 5, borderColor: color, zIndex: 6 }, style]}
    />
  );
}

/** The mated king tips over. */
function FallingKing({ piece, size, reduced }: { piece: Piece; size: number; reduced: boolean }) {
  const t = useSharedValue(reduced ? 1 : 0);
  useEffect(() => {
    if (!reduced) t.value = withDelay(250, withSpring(1, { damping: 7, stiffness: 120 }));
  }, [t, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateY: t.value * size * 0.12 }, { rotate: `${t.value * 78}deg` }] }));
  return (
    <Animated.View pointerEvents="none" style={style}>
      <PieceArt piece={piece} size={size} />
    </Animated.View>
  );
}

const STAR = "M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z";

type BoardProps = {
  fen: string;
  orientation?: Color;
  selected?: Square | null;
  targets?: Square[];
  lastMove?: MoveRef | null;
  check?: Square | null;
  /** The mated king's square: it tips over and the board dims. */
  mate?: Square | null;
  highlight?: Square[];
  hints?: Square[];
  stars?: Square[];
  onTap?: (sq: Square) => void;
  disabled?: boolean;
  shake?: number;
  label?: string;
  /** Fixed board edge (the stage fits it to the space); otherwise fills the width. */
  size?: number;
  radius?: number;
  arrows?: BoardArrow[];
  /** A faded piece on the destination of a suggested move. */
  guide?: { from: Square; to: Square; piece: Piece } | null;
  /** A pawn waiting on its last rank: shows the inline picker on that file. */
  promotion?: MoveRef | null;
  onPromote?: (piece: PromotionPiece | null) => void;
};

type Fx = { id: number; captured: { square: Square; piece: Piece } | null; promoted: Square | null };

export function Board({
  fen,
  orientation = "w",
  selected,
  targets = [],
  lastMove,
  check,
  mate,
  highlight = [],
  hints = [],
  stars = [],
  onTap,
  disabled,
  shake = 0,
  label = copy.lesson.board,
  size: fixed,
  radius = 12,
  arrows = [],
  guide = null,
  promotion,
  onPromote,
}: BoardProps) {
  const { c } = useTheme();
  const { state } = useApp();
  const { coords, legalDots } = state.prefs;
  const reduced = useReducedMotion();
  // Square edge snapped to whole device pixels, so rows never show hairline seams.
  const [measured, setMeasured] = useState(0);
  const snap = (edge: number) => Math.floor((edge / 8) * PixelRatio.get()) / PixelRatio.get();
  const sq = fixed ? snap(fixed) : measured;
  const width = sq * 8;
  const pieces = useMemo(() => readFen(fen), [fen]);
  const squares = useMemo(() => boardSquares(orientation), [orientation]);
  const sign = orientation === "w" ? 1 : -1;

  // Move effects are read by comparing with the position we last drew.
  const [drawn, setDrawn] = useState(fen);
  const [fx, setFx] = useState<Fx | null>(null);
  if (drawn !== fen) {
    setDrawn(fen);
    const e = moveEffects(drawn, fen, lastMove);
    setFx(e.captured || e.promoted ? { id: (fx?.id ?? 0) + 1, captured: e.captured, promoted: e.promoted && lastMove ? lastMove.to : null } : null);
  }

  const shakeX = useSharedValue(0);
  useEffect(() => {
    if (!shake || reduced) return;
    shakeX.value = withSequence(withTiming(-8, { duration: 70 }), withTiming(7, { duration: 80 }), withTiming(-4, { duration: 80 }), withTiming(0, { duration: 80 }));
  }, [shake, reduced, shakeX]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shakeX.value }] }));

  const dim = useSharedValue(0);
  useEffect(() => {
    dim.value = mate ? withDelay(500, withTiming(1, { duration: 500 })) : 0;
  }, [mate, dim]);
  const dimStyle = useAnimatedStyle(() => ({ opacity: dim.value * 0.32 }));

  /* ---------- drag ---------- */
  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const gx = useSharedValue(0);
  const gy = useSharedValue(0);
  const lift = useSharedValue(0);
  const at = (x: number, y: number): Square | null => {
    if (!sq) return null;
    const col = Math.floor(x / sq);
    const row = Math.floor(y / sq);
    return col >= 0 && col < 8 && row >= 0 && row < 8 ? squares[row * 8 + col] : null;
  };
  const canDrag = (s: Square | null): s is Square => {
    if (!s || disabled || promotion || !onTap) return false;
    const p = pieces.get(s);
    return Boolean(p && p.color === turnOf(fen));
  };
  const tapAt = (x: number, y: number) => {
    const s = at(x, y);
    if (s && !disabled && !promotion) onTap?.(s);
  };
  const dragStart = (x: number, y: number) => {
    const s = at(x, y);
    if (!canDrag(s)) return;
    setDragFrom(s);
    if (selected !== s) onTap?.(s);
  };
  const dragEnd = (x: number, y: number) => {
    const from = dragFrom;
    setDragFrom(null);
    const to = at(x, y);
    if (from && to && to !== from) onTap?.(to);
  };
  const tap = Gesture.Tap()
    .maxDuration(400)
    .onEnd((e, ok) => {
      if (ok) runOnJS(tapAt)(e.x, e.y);
    });
  const pan = Gesture.Pan()
    .minDistance(6)
    .onStart((e) => {
      gx.value = e.x;
      gy.value = e.y;
      lift.value = withSpring(1, { damping: 14, stiffness: 260 });
      runOnJS(dragStart)(e.x, e.y);
    })
    .onUpdate((e) => {
      gx.value = e.x;
      gy.value = e.y;
    })
    .onEnd((e) => {
      lift.value = 0;
      runOnJS(dragEnd)(e.x, e.y);
    })
    .onFinalize(() => {
      lift.value = 0;
    });
  const gesture = Gesture.Exclusive(pan, tap);
  const ghostStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: gx.value - sq * 0.6 }, { translateY: gy.value - sq * 1.1 }, { scale: 1 + lift.value * 0.2 }],
  }));
  const hoverStyle = useAnimatedStyle(() => {
    const col = Math.max(0, Math.min(7, Math.floor(gx.value / Math.max(sq, 1))));
    const row = Math.max(0, Math.min(7, Math.floor(gy.value / Math.max(sq, 1))));
    return { opacity: lift.value, transform: [{ translateX: col * sq }, { translateY: row * sq }] };
  });

  const onLayout = (e: LayoutChangeEvent) => {
    if (!fixed) setMeasured(snap(e.nativeEvent.layout.width));
  };
  const xy = (s: Square) => {
    const i = squares.indexOf(s);
    return { x: (i % 8) * sq, y: Math.floor(i / 8) * sq };
  };
  const dragPiece = dragFrom ? pieces.get(dragFrom) : undefined;
  const mover = turnOf(fen);

  return (
    <Animated.View
      onLayout={onLayout}
      style={[{ width: fixed ?? "100%", maxWidth: fixed ?? 560, alignSelf: "center", aspectRatio: 1 }, shakeStyle]}
    >
      <GestureDetector gesture={gesture}>
        <View accessibilityLabel={label} style={{ width, height: width, borderRadius: radius, overflow: "hidden" }}>
          {sq
            ? squares.map((s, i) => {
                const piece = pieces.get(s);
                const row = Math.floor(i / 8);
                const col = i % 8;
                const light = (fileIndex(s) + rankIndex(s)) % 2 === 1;
                const isTarget = targets.includes(s);
                const isLast = Boolean(lastMove && (lastMove.from === s || lastMove.to === s));
                const parts = [squareLabel(s, piece)];
                if (selected === s) parts.push(copy.a11y.selected);
                if (isTarget) parts.push(copy.a11y.target);
                if (stars.includes(s)) parts.push(copy.a11y.star);
                if (isLast) parts.push(copy.a11y.lastMove);
                const slid = !reduced && lastMove?.to === s && s !== mate;
                const inner = sq * 0.88;
                const lifted = dragFrom === s;
                const coordColor = light ? c.boardCoordOnLight : c.boardCoordOnDark;
                return (
                  <View
                    key={s}
                    accessible
                    accessibilityRole="button"
                    accessibilityLabel={parts.join(", ")}
                    accessibilityState={{ disabled: Boolean(disabled), selected: selected === s }}
                    accessibilityActions={[{ name: "activate" }]}
                    onAccessibilityAction={() => !disabled && onTap?.(s)}
                    style={{
                      position: "absolute",
                      left: col * sq,
                      top: row * sq,
                      width: sq,
                      height: sq,
                      backgroundColor: light ? c.boardLight : c.boardDark,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isLast ? <View style={{ position: "absolute", inset: 0, backgroundColor: c.boardMove }} /> : null}
                    {highlight.includes(s) ? <View style={{ position: "absolute", inset: 0, backgroundColor: c.brand, opacity: 0.3 }} /> : null}
                    {selected === s ? <View style={{ position: "absolute", inset: 0, backgroundColor: c.boardSelect }} /> : null}
                    {mate === s ? <View pointerEvents="none" style={{ position: "absolute", inset: 0, backgroundColor: c.danger, opacity: 0.72 }} /> : check === s ? <CheckGlow color={c.boardCheck} reduced={reduced} /> : null}
                    {hints.includes(s) || guide?.from === s || guide?.to === s ? <View style={{ position: "absolute", inset: 0, borderWidth: 5, borderColor: c.boardHint }} /> : null}
                    {coords && col === 0 ? (
                      <Text style={{ position: "absolute", top: 2, left: 3, fontSize: 10, fontFamily: fonts.bold, color: coordColor }}>{s[1]}</Text>
                    ) : null}
                    {coords && row === 7 ? (
                      <Text style={{ position: "absolute", bottom: 1, right: 4, fontSize: 10, fontFamily: fonts.bold, color: coordColor }}>{s[0]}</Text>
                    ) : null}
                    {stars.includes(s) ? (
                      <Svg width={sq * 0.6} height={sq * 0.6} viewBox="0 0 24 24" style={{ position: "absolute" }}>
                        <Path d={STAR} fill={c.gold} stroke={c.goldText} strokeWidth={1.2} />
                      </Svg>
                    ) : null}
                    {guide?.to === s ? (
                      <View pointerEvents="none" style={{ position: "absolute", opacity: 0.45 }}>
                        <PieceArt piece={guide.piece} size={inner} />
                      </View>
                    ) : null}
                    {piece ? (
                      <View style={{ opacity: lifted ? 0.28 : 1 }}>
                        {mate === s ? (
                          <FallingKing piece={piece} size={inner} reduced={reduced} />
                        ) : slid && lastMove ? (
                          <SlidingPiece
                            key={`${lastMove.from}${fen}`}
                            piece={piece}
                            size={inner}
                            pop={fx?.promoted === s}
                            dx={(fileIndex(lastMove.from) - fileIndex(s)) * sign * sq}
                            dy={(rankIndex(s) - rankIndex(lastMove.from)) * sign * sq}
                          />
                        ) : (
                          <PieceArt piece={piece} size={inner} />
                        )}
                      </View>
                    ) : null}
                    {isTarget && legalDots ? (
                      piece ? (
                        <View pointerEvents="none" style={{ position: "absolute", inset: "5%", borderRadius: 999, borderWidth: 4, borderColor: c.boardDot }} />
                      ) : (
                        <View pointerEvents="none" style={{ position: "absolute", width: "28%", height: "28%", borderRadius: 999, backgroundColor: c.boardDot }} />
                      )
                    ) : null}
                  </View>
                );
              })
            : null}

          {sq && dragPiece ? (
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, width: sq, height: sq, borderWidth: 4, borderColor: c.boardHint, borderRadius: 4 }, hoverStyle]} />
          ) : null}

          {sq && fx && !reduced ? (
            <View key={fx.id} pointerEvents="none" style={{ position: "absolute", inset: 0 }}>
              {fx.captured ? (
                <CaptureBurst
                  piece={fx.captured.piece}
                  size={sq}
                  {...xy(fx.captured.square)}
                  tint={fx.captured.piece.color === "w" ? "#FFFFFF" : "#1C1B2E"}
                  spark={c.gold}
                  fly={(fx.captured.piece.color === "b" ? 1 : -1) * (orientation === "w" ? 1 : -1)}
                />
              ) : null}
              {fx.promoted ? <RingFlash size={sq} {...xy(fx.promoted)} color={c.gold} /> : null}
            </View>
          ) : null}

          {sq && arrows.length ? (
            <Svg pointerEvents="none" width={width} height={width} viewBox="0 0 800 800" style={{ position: "absolute", left: 0, top: 0 }}>
              {arrows.map((a) => {
                const g = arrowShape(a, orientation);
                const color = a.tone === "played" ? "rgba(240, 82, 82, 0.85)" : "rgba(30, 170, 110, 0.92)";
                return [
                  <Line key={`${a.from}${a.to}l`} x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={color} strokeWidth={17} strokeLinecap="round" />,
                  <Polygon key={`${a.from}${a.to}h`} points={g.head} fill={color} />,
                ];
              })}
            </Svg>
          ) : null}

          <Animated.View pointerEvents="none" style={[{ position: "absolute", inset: 0, backgroundColor: "#0B0A1A" }, dimStyle]} />
          {mate ? (
            <View pointerEvents="none" style={{ position: "absolute", left: 0, right: 0, top: "42%", alignItems: "center" }}>
              <Text style={{ paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, overflow: "hidden", backgroundColor: c.brand, color: c.onBrand, fontWeight: "800", fontSize: 18 }}>{copy.play.mate}</Text>
            </View>
          ) : null}

          {sq && dragPiece ? (
            <Animated.View pointerEvents="none" style={[{ position: "absolute", left: 0, top: 0, zIndex: 9 }, ghostStyle]}>
              <PieceArt piece={dragPiece} size={sq * 1.2} />
            </Animated.View>
          ) : null}
        </View>
      </GestureDetector>

      {sq && promotion ? (
        <View style={{ position: "absolute", left: 0, top: 0, width, height: width, borderRadius: radius, overflow: "hidden" }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={copy.gym.cancel}
            onPress={() => onPromote?.(null)}
            style={{ position: "absolute", inset: 0, backgroundColor: "rgba(11,10,26,0.45)" }}
          />
          {promotionColumn(promotion.to).map(({ square, piece, index }) => {
            const { x, y } = xy(square);
            return (
              <Animated.View
                key={piece}
                entering={reduced ? undefined : ZoomIn.springify().damping(14).delay(index * 45)}
                style={{ position: "absolute", left: x, top: y, width: sq, height: sq, padding: 3 }}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={copy.gym.promotePieces[piece]}
                  onPress={() => onPromote?.(piece)}
                  style={({ pressed }) => ({
                    flex: 1,
                    borderRadius: sq * 0.22,
                    alignItems: "center",
                    justifyContent: "center",
                    backgroundColor: index === 0 ? c.gold : c.card,
                    transform: [{ scale: pressed ? 0.92 : 1 }],
                    shadowColor: "#000",
                    shadowOpacity: 0.25,
                    shadowRadius: 6,
                    shadowOffset: { width: 0, height: 3 },
                    elevation: 4,
                  })}
                >
                  <PieceArt piece={{ type: piece, color: mover }} size={sq * 0.78} />
                </Pressable>
              </Animated.View>
            );
          })}
        </View>
      ) : null}
    </Animated.View>
  );
}
