import { aiTint, copy } from "@chessschool/design";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View, useWindowDimensions, type StyleProp, type ViewStyle } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Sheet, T } from "./ui";

/**
 * The AI coach in a game as a corner widget: a Cody button that asks for help, and a note that floats
 * over the game below it. It is absolutely placed, so it never moves or resizes the board.
 * Render it absolutely at screen level (`style` places it): Android only takes taps inside a parent's bounds.
 */
export function AiCoachButton({ text, asking, onAsk, style }: { text: string | null; asking: boolean; onAsk: () => void; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  // A new note pops open by itself; the learner can fold it back into the button.
  useEffect(() => setOpen(Boolean(text)), [text]);
  const press = () => (text ? setOpen((o) => !o) : onAsk());
  return (
    <View style={[{ alignItems: "flex-end", gap: 8, zIndex: 20, elevation: 20 }, style]}>
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
      {open && text ? (
        <View
          accessibilityLiveRegion="polite"
          style={{ width: Math.min(320, width - 32), elevation: 8, flexDirection: "row", gap: 8, padding: 12, borderRadius: 18, borderTopRightRadius: 6, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card, shadowColor: "#000", shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } }}
        >
          <Pressable accessibilityRole="button" accessibilityLabel={`${copy.ai.coach}: ${text}`} accessibilityHint={copy.ai.readMore} onPress={() => setFull(true)} style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="sparkles" size={12} color={aiTint.text} />
              <T role="micro" style={{ color: aiTint.text, fontFamily: fonts.bold }}>
                {copy.ai.coach}
              </T>
            </View>
            <T role="small" numberOfLines={4}>
              {text}
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={copy.ai.dismiss} hitSlop={12} onPress={() => setOpen(false)}>
            <Icon name="close" size={18} color={c.textMuted} />
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
    </View>
  );
}
