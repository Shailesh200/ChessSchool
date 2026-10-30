import { Text, View } from "react-native";
import { KitCoachAvatar, usePremiumKitTheme } from "@/components/kit";
import type { CoachCharacterId } from "@/coachCharacters";
import { shadowStyle } from "@/theme/premium/mapTokens";
import { mapCoachAvatarState, type premiumCoachMood } from "./lessonStepUi";

type Props = {
  badge: string;
  title: string;
  coachLine: string;
  coachCharacter: CoachCharacterId | string;
  mood: ReturnType<typeof premiumCoachMood>;
};

export function PremiumLessonCoachSection({ badge, title, coachLine, coachCharacter, mood }: Props) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const avatarState = mapCoachAvatarState(mood);

  return (
    <View style={{ paddingHorizontal: space["4"], gap: space["3"], flexShrink: 0 }}>
      <View style={{ alignItems: "center", gap: space["2"] }}>
        <View
          style={{
            backgroundColor: colors.brand50,
            paddingHorizontal: space["3"],
            paddingVertical: space["1"],
            borderRadius: radius.pill,
          }}
        >
          <Text
            numberOfLines={2}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={{
              fontFamily: font.displaySemibold,
              fontSize: type.xs.fontSize,
              lineHeight: type.xs.lineHeight,
              color: colors.brand,
              textAlign: "center",
            }}
          >
            {badge}
          </Text>
        </View>
        <Text
          numberOfLines={3}
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          style={{
            fontFamily: font.displayBold,
            fontSize: type.xl.fontSize,
            lineHeight: type.xl.lineHeight,
            color: colors.ink,
            textAlign: "center",
            letterSpacing: -0.3,
          }}
        >
          {title}
        </Text>
      </View>
      <View style={{ flexDirection: "row", alignItems: "flex-start", gap: space["2"] }}>
        <KitCoachAvatar character={coachCharacter} state={avatarState} size={56} />
        <View
          style={[
            shadowStyle("elev-1"),
            {
              flex: 1,
              backgroundColor: colors.surfaceCard,
              borderRadius: radius.lg,
              borderBottomLeftRadius: 6,
              paddingHorizontal: space["4"],
              paddingVertical: space["3"],
              borderWidth: 1,
              borderColor: colors.hairline,
            },
          ]}
        >
          <Text
            style={{
              fontFamily: font.displayMedium,
              fontSize: type.sm.fontSize,
              lineHeight: type.sm.lineHeight,
              color: colors.ink,
              flexShrink: 1,
            }}
          >
            {coachLine}
          </Text>
        </View>
      </View>
    </View>
  );
}
