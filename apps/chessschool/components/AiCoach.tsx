import { aiTint, copy } from "@chessschool/design";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, Sheet, T } from "./ui";

/** A line from the AI coach in a game (hint reason or mistake comment), framed in the AI's violet. */
export function AiCoachCard({ kind, text }: { kind: "hint" | "comment"; text: string }) {
  const { c } = useTheme();
  // A two-line strip that never covers the game; the whole note opens in a sheet.
  const [open, setOpen] = useState(false);
  const [closed, setClosed] = useState<string | null>(null);
  if (closed === text) return null;
  const label = kind === "hint" ? copy.ai.hint : copy.ai.coach;
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text}`}
        accessibilityHint={copy.ai.readMore}
        onPress={() => setOpen(true)}
        style={{ flexDirection: "row", gap: 10, alignItems: "center", paddingVertical: 8, paddingHorizontal: 10, borderRadius: 16, borderWidth: 1.5, borderColor: aiTint.ink, backgroundColor: c.card }}
      >
        <Cody size={32} />
        <View style={{ flex: 1, gap: 2 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Icon name="sparkles" size={12} color={aiTint.text} />
            <T role="micro" style={{ color: aiTint.text, fontFamily: fonts.bold }}>
              {label}
            </T>
          </View>
          <T role="small" numberOfLines={2}>
            {text}
          </T>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={copy.ai.dismiss} hitSlop={10} onPress={() => setClosed(text)}>
          <Icon name="close" size={18} color={c.textMuted} />
        </Pressable>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} scroll>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <Cody size={44} />
          <View style={{ flex: 1, gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Icon name="sparkles" size={14} color={aiTint.text} />
              <T role="micro" style={{ color: aiTint.text, fontFamily: fonts.bold }}>
                {label}
              </T>
            </View>
            <T role="body">{text}</T>
          </View>
        </View>
        <Button title={copy.ai.gotIt} onPress={() => setOpen(false)} />
      </Sheet>
    </>
  );
}
