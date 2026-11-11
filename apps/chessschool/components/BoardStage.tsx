import { useState } from "react";
import { useWindowDimensions, View, type LayoutChangeEvent } from "react-native";

const MAX_BOARD = 720;
const BAR = 36;
const GAP = 6;
const INSET = 8;

/**
 * Player bar, board, player bar. The board is the largest square that fits,
 * with a small inset so it never kisses the screen edge.
 */
export function BoardStage({
  top,
  bottom,
  topSize = BAR,
  bottomSize = BAR,
  children,
}: {
  top: React.ReactNode;
  bottom?: React.ReactNode;
  topSize?: number;
  bottomSize?: number;
  children: (size: number, radius: number) => React.ReactNode;
}) {
  const { width: screen } = useWindowDimensions();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: Math.floor(width), h: Math.floor(height) });
  };
  const bars = topSize + GAP + (bottom ? bottomSize + GAP : 0);
  const width = Math.min(box.w || screen, screen) - INSET * 2;
  const size = Math.max(0, Math.floor(Math.min(width, box.h - bars, MAX_BOARD)));
  return (
    <View onLayout={onLayout} style={{ flex: 1, minHeight: 0, justifyContent: "center", gap: GAP }}>
      {box.h ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: topSize, paddingHorizontal: INSET }}>{top}</View>
          <View style={{ alignItems: "center" }}>{children(size, 8)}</View>
          {bottom ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: bottomSize, paddingHorizontal: INSET }}>{bottom}</View> : null}
        </>
      ) : null}
    </View>
  );
}
