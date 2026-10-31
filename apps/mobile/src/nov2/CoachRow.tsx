import { Image, StyleSheet, Text, View } from "react-native";
import { coachStill, type CoachMood, type CoachSlug } from "./coachArt";
import { premiumColors, premiumFont, premiumRadius, premiumSpace, premiumType } from "./premiumTokens";

export function CoachHead({ slug, mood = "neutral", size = 48 }: { slug: CoachSlug; mood?: CoachMood; size?: number }) {
  return (
    <Image
      source={coachStill(slug, mood)}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: premiumColors.surface }}
      accessibilityIgnoresInvertColors
    />
  );
}

export function CoachBubble({ text, strong }: { text: string; strong?: boolean }) {
  return (
    <View style={[styles.bubble, strong && styles.strong]}>
      <Text style={styles.copy}>{text}</Text>
    </View>
  );
}

export function CoachRow({
  slug,
  mood,
  text,
  strong,
  size = 72,
}: {
  slug: CoachSlug;
  mood?: CoachMood;
  text: string;
  strong?: boolean;
  size?: number;
}) {
  return (
    <View style={styles.row}>
      <CoachHead slug={slug} mood={mood} size={size} />
      <CoachBubble text={text} strong={strong} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: premiumSpace[3] },
  bubble: {
    flex: 1,
    backgroundColor: premiumColors.coachBubble,
    borderWidth: 1.5,
    borderColor: premiumColors.line,
    borderRadius: premiumRadius.lg,
    paddingVertical: 11,
    paddingHorizontal: premiumSpace[4],
  },
  strong: { backgroundColor: premiumColors.surfaceSoft, borderColor: premiumColors.brandSoft },
  copy: { ...premiumType.body, fontFamily: premiumFont.ui, color: premiumColors.text },
});
