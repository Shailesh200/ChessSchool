import { useState } from "react";
import { View, type LayoutChangeEvent } from "react-native";
import { useTheme } from "@/lib/theme";

/**
 * The "table": a card with a top bar (coach or opponent), the board, and a bottom bar (you).
 * The board gets the largest square that fits the space left, so it grows on tall screens.
 */
export function BoardStage({ top, bottom, children }: { top: React.ReactNode; bottom?: React.ReactNode; children: (size: number) => React.ReactNode }) {
  const { c, scheme } = useTheme();
  const [box, setBox] = useState({ w: 0, h: 0 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setBox({ w: Math.floor(width), h: Math.floor(height) });
  };
  const size = Math.min(box.w, box.h, 560);
  return (
    <View
      style={{
        flex: 1,
        minHeight: bottom ? 360 : 300,
        padding: 10,
        gap: 8,
        borderRadius: 26,
        backgroundColor: c.card,
        borderWidth: 1,
        borderColor: c.line,
        shadowColor: "#1C1B2E",
        shadowOpacity: scheme === "dark" ? 0 : 0.08,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 8 },
        elevation: scheme === "dark" ? 0 : 2,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 }}>{top}</View>
      <View onLayout={onLayout} style={{ flex: 1, minHeight: 240, alignItems: "center", justifyContent: "center" }}>
        {size > 0 ? children(size) : null}
      </View>
      {bottom ? <View style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 52 }}>{bottom}</View> : null}
    </View>
  );
}
