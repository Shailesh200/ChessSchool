import { aiTint, copy } from "@chessschool/design";
import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, Animated, PanResponder, Pressable, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Sheet, T } from "./ui";

const SIZE = 56;

/** Where the learner last left the button, kept while the app runs so it is in the same place on every screen. */
let dock: { side: "left" | "right"; y: number | null } = { side: "right", y: null };

/**
 * Chaukor AI: a floating button docked to the edge of the screen. Drag it up and down an edge or across to
 * the other one; it snaps to the nearer edge. Tapping it asks for help; a note opens as a one-line bubble
 * beside it (tap for the whole note). It floats over everything, so it never moves the board. Android only
 * takes taps inside a parent's bounds, so render it as a direct child of the screen's root.
 */
export function AiCoachButton({ text, asking, onAsk }: { text: string | null; asking: boolean; onAsk: () => void }) {
  const { c } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [spot, setSpot] = useState(dock);
  const [dragging, setDragging] = useState(false);
  const pan = useRef(new Animated.ValueXY()).current;
  const minY = insets.top + 8;
  const maxY = height - insets.bottom - SIZE - 96;
  const y = Math.max(minY, Math.min(maxY, spot.y ?? height * 0.42));
  const at = useRef(y);
  at.current = y;
  const responder = useMemo(
    () =>
      PanResponder.create({
        // Small movements stay taps; a real drag moves the button.
        onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) + Math.abs(g.dy) > 8,
        onPanResponderGrant: () => setDragging(true),
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false }),
        onPanResponderRelease: (_, g) => {
          pan.setValue({ x: 0, y: 0 });
          setDragging(false);
          dock = { side: g.moveX < width / 2 ? "left" : "right", y: at.current + g.dy };
          setSpot(dock);
        },
        onPanResponderTerminate: () => {
          pan.setValue({ x: 0, y: 0 });
          setDragging(false);
        },
      }),
    [pan, width],
  );
  // A new note pops up as a one-line bubble; the learner can fold it back into the button.
  useEffect(() => setOpen(Boolean(text)), [text]);
  const right = spot.side === "right";
  const press = () => (text ? (open ? setFull(true) : setOpen(true)) : onAsk());
  // Docked flush to the edge: rounded on the side facing the screen, flat against the edge.
  const round = { [right ? "borderTopLeftRadius" : "borderTopRightRadius"]: SIZE / 2, [right ? "borderBottomLeftRadius" : "borderBottomRightRadius"]: SIZE / 2 };
  return (
    <Animated.View
      {...responder.panHandlers}
      accessibilityLiveRegion="polite"
      style={{ position: "absolute", top: y, [spot.side]: 0, zIndex: 20, elevation: 20, flexDirection: right ? "row-reverse" : "row", alignItems: "center", gap: 8, transform: pan.getTranslateTransform() }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copy.ai.ask}
        accessibilityHint={copy.ai.move}
        accessibilityState={{ busy: asking, expanded: open }}
        onPress={press}
        style={{ width: SIZE, height: SIZE, alignItems: "center", justifyContent: "center", ...round, borderWidth: 1.5, [right ? "borderRightWidth" : "borderLeftWidth"]: 0, borderColor: aiTint.ink, backgroundColor: c.card, elevation: 8, shadowColor: "#000", shadowOpacity: dragging ? 0.28 : 0.18, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}
      >
        {asking ? <ActivityIndicator color={aiTint.text} /> : <Cody size={38} />}
        {text && !open ? <View style={{ position: "absolute", top: 4, [right ? "left" : "right"]: 4, width: 12, height: 12, borderRadius: 6, backgroundColor: aiTint.ink, borderWidth: 2, borderColor: c.card }} /> : null}
      </Pressable>
      {open && text && !dragging ? (
        <View style={{ maxWidth: Math.min(280, width - SIZE - 24), flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8, paddingLeft: 12, paddingRight: 8, borderRadius: 18, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, elevation: 6, shadowColor: "#000", shadowOpacity: 0.16, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } }}>
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
