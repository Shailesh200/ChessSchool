import { aiTint, copy } from "@chessschool/design";
import { View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { T } from "./ui";

/** The small "AI" pill on a bot's avatar or name. */
export function AiBadge({ style }: { style?: object }) {
  return (
    <View style={[{ paddingHorizontal: 6, height: 18, borderRadius: 999, backgroundColor: aiTint.ink, alignItems: "center", justifyContent: "center" }, style]}>
      <T role="micro" style={{ color: "#fff", fontFamily: fonts.bold, fontSize: 10, lineHeight: 12 }}>
        {copy.ai.badge}
      </T>
    </View>
  );
}

/** A line from the AI coach in a game (hint reason or mistake comment), framed in the AI's violet. */
export function AiCoachCard({ kind, text }: { kind: "hint" | "comment"; text: string }) {
  const { c } = useTheme();
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", padding: 12, borderRadius: 18, borderWidth: 2, borderColor: aiTint.ink, backgroundColor: c.card }}>
      <Cody size={44} />
      <View style={{ flex: 1, gap: 4 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          <Icon name="sparkles" size={14} color={aiTint.text} />
          <T role="micro" style={{ color: aiTint.text, fontFamily: fonts.bold }}>
            {kind === "hint" ? copy.ai.hint : copy.ai.coach}
          </T>
        </View>
        <T role="body">{text}</T>
      </View>
    </View>
  );
}
