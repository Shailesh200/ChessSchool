import { aiTint, copy } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Pressable, View, useWindowDimensions } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Sheet, T } from "./ui";

/**
 * The AI coach in a game as a corner widget: a Cody button that asks for help, with a one-line bubble
 * beside it when a note arrives (tap for the whole note). It floats at screen level, so it never moves
 * the board, and can be dragged to either side and any height; it snaps to the nearest edge.
 * Android only takes taps inside a parent's bounds, so render it as a direct child of the screen.
 */
export function AiCoachButton({ text, asking, onAsk, top }: { text: string | null; asking: boolean; onAsk: () => void; top: number }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [spot, setSpot] = useState<{ side: "left" | "right"; y: number } | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const y = spot?.y ?? top;
  const side = spot?.side ?? "right";
  const drag = useRef({ y, side });
  drag.current = { y, side };
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Small movements stay taps; a real drag moves the widget.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          pan.setValue({ x: 0, y: 0 });
          setSpot({ side: g.moveX < width / 2 ? "left" : "right", y: Math.max(0, Math.min(height - 160, drag.current.y + g.dy)) });
        },
        onPanResponderTerminate: () => pan.setValue({ x: 0, y: 0 }),
      }),
    [pan, width, height],
  );
  // A new note pops up as a one-line bubble; the learner can fold it back into the button.
  useEffect(() => setOpen(Boolean(text)), [text]);
  const press = () => (text ? (open ? setFull(true) : setOpen(true)) : onAsk());
  const bubble =
    open && text ? (
      <View style={{ flexShrink: 1, maxWidth: Math.min(280, width - 96), flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, borderRadius: 18, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, elevation: 6, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${copy.ai.coach}: ${text}`} accessibilityHint={copy.ai.readMore} onPress={() => setFull(true)} style={{ flexShrink: 1 }}>
          <T role="small" numberOfLines={1}>
            {text}
          </T>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.ai.dismiss} hitSlop={12} onPress={() => setOpen(false)}>
          <Icon name="close" size={16} color={c.textMuted} />
        </Pressable>
      </View>
    ) : null;
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", top: y, [side]: 8, zIndex: 20, elevation: 20, flexDirection: side === "right" ? "row-reverse" : "row", alignItems: "center", gap: 8, transform: pan.getTranslateTransform() }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.ai.ask}
        accessibilityState={{ busy: asking, expanded: open }}
        onPress={press}
        style={{ width: 52, height: 52, borderRadius: 26, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, alignItems: "center", justifyContent: "center" }}
      >
        {asking ? <ActivityIndicator color={aiTint.text} /> : <Cody size={36} />}
        {text && !open ? <View style={{ position: "absolute", top: 2, right: 2, width: 12, height: 12, borderRadius: 6, backgroundColor: aiTint.ink, borderWidth: 2, borderColor: c.card }} /> : null}
      </Pressable>
      {bubble}
      <Sheet visible={full} onClose={() => setFull(false)} scroll>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Cody size={44} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="sparkles" size={14} color={aiTint.text} />
              <T role="micro" style={{ color: aiTint.text, fontFamily: fonts.bold }}>
                {copy.ai.coach}
              </T>
            </View>
            <T role="body">{text}</T>
          </View>
        </View>
        <Button title={copy.ai.gotIt} onPress={() => setFull(false)} />
      </Sheet>
    </Animated.View>
  );
}
