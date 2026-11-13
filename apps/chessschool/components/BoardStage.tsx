import { useState } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent } from "react-native";

const MAX_BOARD = 720;
const BAR = 36;
const GAP = 6;
const INSET = 8;

/**
 * Player bar, board, player bar. The board is the largest square that fits,
 * with a small inset so it never kisses the screen edge.
 * `fixed` locks each bar to its given height so coach copy cannot push the board.
 */
export function BoardStage({
  top,
  bottom,
  topSize = BAR,
  bottomSize = BAR,
  fixed = false,
  children,
}: {
  top: React.ReactNode;
  bottom?: React.ReactNode;
  topSize?: number;
  bottomSize?: number;
  fixed?: boolean;
  children: (size: number, radius: number) => React.ReactNode;
}) {
  const { width: screen } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    const next = { w: Math.floor(width), h: Math.floor(height) };
    setBox((prev) => (prev.w === next.w && prev.h === next.h ? prev : next));
  };
  const bars = topSize + GAP + (bottom ? bottomSize + GAP : 0);
  const width = Math.min(box.w || screen, screen) - INSET * 2;
  const size = Math.max(0, Math.floor(Math.min(width, box.h - bars, MAX_BOARD)));
  const bar = (sizePx: number) => (fixed ? { height: sizePx, overflow: "hidden" as const } : { minHeight: sizePx });
  return (
    <View onLayout={onLayout} style={{ flex: 1, minHeight: 0, justifyContent: fixed ? "flex-start" : "center", gap: GAP }}>
      {box.h ? (
        <>
          <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET }, bar(topSize)]}>{top}</View>
          <View style={{ alignItems: "center" }}>{children(size, 8)}</View>
          {bottom ? <View style={[{ flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: INSET }, bar(bottomSize)]}>{bottom}</View> : null}
        </>
      ) : null}
    </View>
  );
}
