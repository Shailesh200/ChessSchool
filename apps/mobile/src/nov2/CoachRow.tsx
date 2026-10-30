import { Image, StyleSheet, Text, View } from "react-native";
import { KitCoachAvatar, usePremiumKitTheme } from "@/components/kit";
import { coachStill, type CoachMood, type CoachSlug } from "./coachArt";
import { coachMoodToAvatarState, slugToCharacterId } from "./coachKit";

/** Dex head still (match chrome) — keeps pixel art from design PNGs. */
export function CoachHead({ slug, mood = "neutral", size = 48 }: { slug: CoachSlug; mood?: CoachMood; size?: number }) {
  const { colors } = usePremiumKitTheme();
  return (
    <Image
      source={coachStill(slug, mood)}
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: colors.surfaceCard }}
      accessibilityIgnoresInvertColors
    />
  );
}

export function CoachBubble({ text, strong }: { text: string; strong?: boolean }) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  return (
    <View
      style={[
        styles.bubble,
        {
          backgroundColor: strong ? colors.surfacePaper : colors.surfaceCard,
          borderColor: strong ? colors.brand100 : colors.hairline,
          borderRadius: radius.lg,
          paddingVertical: 11,
          paddingHorizontal: space["4"],
        },
      ]}
    >
      <Text style={{ fontFamily: font.uiRegular, fontSize: type.base.fontSize, lineHeight: type.base.lineHeight, color: colors.ink }}>
        {text}
      </Text>
    </View>
  );
}

/** Coach line with kit avatar (onboarding, auth, placement). */
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
  const { space } = usePremiumKitTheme();
  const character = slugToCharacterId(slug);
  const state = coachMoodToAvatarState(mood);
  return (
    <View style={[styles.row, { gap: space["3"] }]}>
      <KitCoachAvatar character={character} state={state} size={Math.round(size * 0.72)} />
      <CoachBubble text={text} strong={strong} />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  bubble: { flex: 1, borderWidth: 1.5 },
});
