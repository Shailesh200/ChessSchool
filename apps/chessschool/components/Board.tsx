import {
  arrowShape,
  boardSquares,
  fileIndex,
  isPieceSet,
  pieceArtwork,
  rankIndex,
  readFen,
  squareLabel,
  type BoardArrow,
  type Color,
  type MoveRef,
  type Piece,
  type PieceOp,
  type PieceSetId,
  type Square,
} from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { memo, useEffect, useMemo, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  PixelRatio,
  Pressable,
  Text,
  View,
  type LayoutChangeEvent,
} from "react-native";
import Svg, { Circle, Ellipse, Line, Path, Polygon } from "react-native-svg";
import { useReducedMotion } from "@/lib/hooks";
import { PIECE_PNGS } from "@/lib/pieceAssets";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

function renderOp(op: PieceOp, key: number) {
  const fill = op.fill ?? "#000";
  if (op.t === "circle")
    return <Circle key={key} cx={op.cx} cy={op.cy} r={op.r} fill={fill} stroke={op.stroke} strokeWidth={op.sw} />;
  if (op.t === "ellipse")
    return (
      <Ellipse key={key} cx={op.cx} cy={op.cy} rx={op.rx} ry={op.ry} fill={fill} stroke={op.stroke} strokeWidth={op.sw} />
    );
  return (
    <Path
      key={key}
      d={op.d}
      fill={fill}
      stroke={op.stroke}
      strokeWidth={op.sw}
      strokeLinejoin={op.lj as "round" | undefined}
      strokeLinecap={op.lc as "round" | undefined}
      fillOpacity={op.fo}
      fillRule={op.fr as "evenodd" | undefined}
    />
  );
}

/** One piece in the chosen set (the learner's set unless `set` is given). */
export const PieceArt = memo(function PieceArt({
  piece,
  size,
  set,
}: {
  piece: Piece;
  size: number;
  set?: PieceSetId;
}) {
  const { state } = useApp();
  const chosen = set ?? (isPieceSet(state.prefs.pieceSet) ? state.prefs.pieceSet : "toy");
  const art = pieceArtwork(chosen, piece.color, piece.type);
  if (art.kind === "asset") {
    return <Image source={PIECE_PNGS[art.asset]} style={{ width: size, height: size }} resizeMode="contain" />;
  }
  const d = art.drawing;
  return (
    <Svg width={size} height={size} viewBox={d.viewBox}>
      {d.ops.map(renderOp)}
    </Svg>
  );
});

/** A piece that slides in from where it came from (the last move). */
function SlidingPiece({
  piece,
  size,
  dx,
  dy,
}: {
  piece: Piece;
  size: number;
  dx: number;
  dy: number;
}) {
  const [t] = useState(() => new Animated.Value(dx || dy ? 1 : 0));
  useEffect(() => {
    if (!dx && !dy) return;
    Animated.timing(t, {
      toValue: 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [t, dx, dy]);
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        zIndex: 3,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
        ],
      }}
    >
      <PieceArt piece={piece} size={size} />
    </Animated.View>
  );
}

const ROWS = [0, 1, 2, 3, 4, 5, 6, 7];
const STAR =
  "M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9L12 2.8Z";

type BoardProps = {
  fen: string;
  orientation?: Color;
  selected?: Square | null;
  targets?: Square[];
  lastMove?: MoveRef | null;
  check?: Square | null;
  highlight?: Square[];
  hints?: Square[];
  stars?: Square[];
  onTap?: (sq: Square) => void;
  disabled?: boolean;
  shake?: number;
  label?: string;
  /** Fixed board edge (the stage fits it to the space); otherwise fills the width. */
  size?: number;
  arrows?: BoardArrow[];
};

export function Board({
  fen,
  orientation = "w",
  selected,
  targets = [],
  lastMove,
  check,
  highlight = [],
  hints = [],
  stars = [],
  onTap,
  disabled,
  shake = 0,
  label = copy.lesson.board,
  size: fixed,
  arrows = [],
}: BoardProps) {
  const { c } = useTheme();
  const { state } = useApp();
  const { coords, legalDots } = state.prefs;
  const reduced = useReducedMotion();
  // Square edge snapped to whole device pixels, so rows never show hairline seams.
  const [measured, setSqSize] = useState(0);
  const snap = (edge: number) => Math.floor(((edge - 8) / 8) * PixelRatio.get()) / PixelRatio.get();
  const sqSize = fixed ? snap(fixed) : measured;
  const [shakeX] = useState(() => new Animated.Value(0));
  const pieces = useMemo(() => readFen(fen), [fen]);
  const squares = useMemo(() => boardSquares(orientation), [orientation]);
  const size = sqSize;
  const width = sqSize * 8 + 8;

  useEffect(() => {
    if (!shake || reduced) return;
    shakeX.setValue(0);
    Animated.sequence(
      [-8, 7, -4, 0].map((v) =>
        Animated.timing(shakeX, {
          toValue: v,
          duration: 80,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
      ),
    ).start();
  }, [shake, reduced, shakeX]);

  const onLayout = (e: LayoutChangeEvent) => {
    if (!fixed) setSqSize(snap(e.nativeEvent.layout.width));
  };
  const sign = orientation === "w" ? 1 : -1;

  return (
    <Animated.View
      accessibilityLabel={label}
      onLayout={onLayout}
      style={{
        width: fixed ?? "100%",
        maxWidth: fixed ?? 520,
        alignSelf: "center",
        alignItems: "center",
        aspectRatio: 1,
        transform: [{ translateX: shakeX }],
      }}
    >
      <View
        style={{
          width,
          height: width,
          borderRadius: 16,
          overflow: "hidden",
          borderWidth: 4,
          borderColor: c.card,
        }}
      >
        {sqSize
          ? ROWS.map((row) => (
              <View key={row} style={{ flexDirection: "row" }}>
                {squares.slice(row * 8, row * 8 + 8).map((sq, col) => {
                  const i = row * 8 + col;
                  const piece = pieces.get(sq);
                  const light = (fileIndex(sq) + rankIndex(sq)) % 2 === 1;
                  const isTarget = targets.includes(sq);
                  const isLast = Boolean(
                    lastMove && (lastMove.from === sq || lastMove.to === sq),
                  );
                  const parts = [squareLabel(sq, piece)];
                  if (selected === sq) parts.push(copy.a11y.selected);
                  if (isTarget) parts.push(copy.a11y.target);
                  if (stars.includes(sq)) parts.push(copy.a11y.star);
                  if (isLast) parts.push(copy.a11y.lastMove);
                  const slid = !reduced && lastMove?.to === sq;
                  const inner = size - 2;
                  return (
                    <Pressable
                      key={sq}
                      accessibilityRole="button"
                      accessibilityLabel={parts.join(", ")}
                      accessibilityState={{
                        disabled: Boolean(disabled),
                        selected: selected === sq,
                      }}
                      onPress={() => !disabled && onTap?.(sq)}
                      style={{
                        width: sqSize,
                        height: sqSize,
                        backgroundColor: light ? c.boardLight : c.boardDark,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isLast ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: c.boardMove,
                          }}
                        />
                      ) : null}
                      {highlight.includes(sq) ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: c.brand,
                            opacity: 0.3,
                          }}
                        />
                      ) : null}
                      {selected === sq ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            backgroundColor: c.boardSelect,
                          }}
                        />
                      ) : null}
                      {check === sq ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: "12%",
                            borderRadius: 999,
                            backgroundColor: c.boardCheck,
                          }}
                        />
                      ) : null}
                      {hints.includes(sq) ? (
                        <View
                          style={{
                            position: "absolute",
                            inset: 0,
                            borderWidth: 5,
                            borderColor: c.boardHint,
                          }}
                        />
                      ) : null}
                      {coords && i % 8 === 0 ? (
                        <Text
                          style={{
                            position: "absolute",
                            top: 2,
                            left: 3,
                            fontSize: 10,
                            fontFamily: fonts.bold,
                            color: light ? c.boardCoordOnLight : c.boardCoordOnDark,
                          }}
                        >
                          {sq[1]}
                        </Text>
                      ) : null}
                      {coords && i >= 56 ? (
                        <Text
                          style={{
                            position: "absolute",
                            bottom: 1,
                            right: 4,
                            fontSize: 10,
                            fontFamily: fonts.bold,
                            color: light ? c.boardCoordOnLight : c.boardCoordOnDark,
                          }}
                        >
                          {sq[0]}
                        </Text>
                      ) : null}
                      {stars.includes(sq) ? (
                        <Svg
                          width={size * 0.6}
                          height={size * 0.6}
                          viewBox="0 0 24 24"
                          style={{ position: "absolute" }}
                        >
                          <Path
                            d={STAR}
                            fill={c.gold}
                            stroke={c.goldText}
                            strokeWidth={1.2}
                          />
                        </Svg>
                      ) : null}
                      {piece ? (
                        slid && lastMove ? (
                          <SlidingPiece
                            key={`${lastMove.from}${fen}`}
                            piece={piece}
                            size={inner * 0.88}
                            dx={
                              (fileIndex(lastMove.from) - fileIndex(sq)) * sign * sqSize
                            }
                            dy={
                              (rankIndex(sq) - rankIndex(lastMove.from)) * sign * sqSize
                            }
                          />
                        ) : (
                          <PieceArt piece={piece} size={inner * 0.88} />
                        )
                      ) : null}
                      {isTarget && legalDots ? (
                        piece ? (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              inset: "6%",
                              borderRadius: 999,
                              borderWidth: 4,
                              borderColor: c.boardDot,
                            }}
                          />
                        ) : (
                          <View
                            pointerEvents="none"
                            style={{
                              position: "absolute",
                              width: "28%",
                              height: "28%",
                              borderRadius: 999,
                              backgroundColor: c.boardDot,
                            }}
                          />
                        )
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
            ))
          : null}
        {sqSize && arrows.length ? (
          <Svg pointerEvents="none" width={sqSize * 8} height={sqSize * 8} viewBox="0 0 800 800" style={{ position: "absolute", left: 0, top: 0 }}>
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
      </View>
    </Animated.View>
  );
}
