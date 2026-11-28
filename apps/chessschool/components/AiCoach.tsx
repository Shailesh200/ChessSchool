import { aiTint, copy } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Pressable, View, useWindowDimensions } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Sheet, T } from "./ui";

const W = 124;
const H = 44;

type Home = { x: number; y: number };

/**
 * Where Chaukor AI sits until it is dragged: put `slot` in the layout (it keeps the space free) and spread
 * `rootProps` on the screen's root view, which must also hold the widget.
 */
export function useAiSlot() {
  const root = useRef<View>(null);
  const slot = useRef<View>(null);
  const [home, setHome] = useState<Home | null>(null);
  // Both measured in the window, so the offset is right whatever the status bar does.
  const place = () => root.current?.measureInWindow((rx, ry) => slot.current?.measureInWindow((sx, sy) => setHome({ x: sx - rx, y: sy - ry })));
  return { home, rootProps: { ref: root, onLayout: place, collapsable: false }, slot: <View ref={slot} onLayout={place} collapsable={false} style={{ width: W, height: H }} /> };
}

/**
 * Chaukor AI: a draggable button that floats over the screen, so it never moves the board. Tapping it asks
 * for help; a note arrives as a one-line bubble under it (tap for the whole note). Drag it anywhere; it
 * snaps to the nearer side. Android only takes taps inside a parent's bounds, so render it as a direct
 * child of the screen's root.
 */
export function AiCoachButton({ text, asking, onAsk, home }: { text: string | null; asking: boolean; onAsk: () => void; home: Home | null }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [spot, setSpot] = useState<{ side: "left" | "right"; y: number } | null>(null);
  const pan = useRef(new Animated.ValueXY()).current;
  const y = spot?.y ?? home?.y ?? 0;
  const drag = useRef(y);
  drag.current = y;
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Small movements stay taps; a real drag moves the widget.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          pan.setValue({ x: 0, y: 0 });
          setSpot({ side: g.moveX < width / 2 ? "left" : "right", y: Math.max(0, Math.min(height - 160, drag.current + g.dy)) });
        },
        onPanResponderTerminate: () => pan.setValue({ x: 0, y: 0 }),
      }),
    [pan, width, height],
  );
  // A new note pops up as a one-line bubble; the learner can fold it back into the button.
  useEffect(() => setOpen(Boolean(text)), [text]);
  if (!home && !spot) return null;
  const side = spot?.side ?? "right";
  // Until dragged, the pill's right edge stays on its slot so a wide bubble grows to the left.
  const edge = spot ? 8 : Math.max(8, width - home!.x - W);
  const press = () => (text ? (open ? setFull(true) : setOpen(true)) : onAsk());
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", top: y, [side]: edge, zIndex: 20, elevation: 20, alignItems: side === "right" ? "flex-end" : "flex-start", gap: 8, maxWidth: width - 16, transform: pan.getTranslateTransform() }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.ai.ask}
        accessibilityHint={copy.ai.move}
        accessibilityState={{ busy: asking, expanded: open }}
        onPress={press}
        style={{ height: H, minWidth: W, flexDirection: "row", alignItems: "center", gap: 6, paddingLeft: 6, paddingRight: 14, borderRadius: H / 2, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, elevation: 6, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}
      >
        <View style={{ width: 30, height: 30, alignItems: "center", justifyContent: "center" }}>{asking ? <ActivityIndicator color={aiTint.text} /> : <Cody size={30} />}</View>
        <T role="label" numberOfLines={1} style={{ fontFamily: fonts.bold }}>
          {copy.ai.coach}
        </T>
        {text && !open ? <View style={{ position: "absolute", top: -2, right: -2, width: 12, height: 12, borderRadius: 6, backgroundColor: aiTint.ink, borderWidth: 2, borderColor: c.card }} /> : null}
      </Pressable>
      {open && text ? (
        <View style={{ maxWidth: Math.min(300, width - 16), flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, borderRadius: 18, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, elevation: 6, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
          <Pressable accessibilityRole="button" accessibilityLabel={`${copy.ai.coach}: ${text}`} accessibilityHint={copy.ai.readMore} onPress={() => setFull(true)} style={{ flexShrink: 1 }}>
            <T role="small" numberOfLines={1}>
              {text}
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.ai.dismiss} hitSlop={12} onPress={() => setOpen(false)}>
            <Icon name="close" size={16} color={c.textMuted} />
          </Pressable>
        </View>
      ) : null}
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
