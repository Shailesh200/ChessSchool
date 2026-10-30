import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KitButton, KitIcon, usePremiumKitTheme } from "@/components/kit";
import { shadowStyle } from "@/theme/premium/mapTokens";

type CorrectProps = {
  variant: "correct";
  title: string;
  body: string;
  xpDelta?: number;
  onContinue: () => void;
  continueLabel?: string;
};

type WrongProps = {
  variant: "wrong";
  title: string;
  body: string;
  onTryAgain: () => void;
  onShowMe?: () => void;
};

type Props = CorrectProps | WrongProps;

export function PremiumLessonFeedbackBar(props: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const wrong = props.variant === "wrong";
  const bg = wrong ? colors.chipStreakBg : colors.brand50;
  const titleColor = wrong ? colors.ink : colors.brand;
  const bodyColor = wrong ? colors.ink700 : colors.brand700;

  return (
    <View
      style={{
        paddingHorizontal: space["4"],
        paddingBottom: Math.max(insets.bottom, space["3"]),
        paddingTop: space["2"],
      }}
    >
      {props.variant === "correct" && props.xpDelta && props.xpDelta > 0 ? (
        <View
          style={{
            alignSelf: "flex-end",
            marginBottom: space["2"],
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.gold,
            paddingHorizontal: space["3"],
            paddingVertical: space["1.5"],
            borderRadius: radius.pill,
          }}
        >
          <KitIcon name="sparkles" size={14} color={colors.ink} />
          <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.ink }}>
            +{props.xpDelta} XP
          </Text>
        </View>
      ) : null}
      <View
        style={[
          shadowStyle("elev-2"),
          {
            backgroundColor: bg,
            borderRadius: radius.xl,
            padding: space["4"],
            gap: space["3"],
            borderWidth: 1,
            borderColor: colors.hairline,
          },
        ]}
      >
        <View style={{ flexDirection: "row", gap: space["3"], alignItems: "flex-start" }}>
          <View
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: wrong ? colors.accent : colors.brand,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <KitIcon name={wrong ? "x" : "check"} size={22} color={colors.surfaceCard} strokeWidth={2.5} />
          </View>
          <View style={{ flex: 1, gap: space["1"] }}>
            <Text
              style={{
                fontFamily: font.displayBold,
                fontSize: type.lg.fontSize,
                lineHeight: type.lg.lineHeight,
                color: titleColor,
              }}
            >
              {props.title}
            </Text>
            <Text
              style={{
                fontFamily: font.displayMedium,
                fontSize: type.sm.fontSize,
                lineHeight: type.sm.lineHeight,
                color: bodyColor,
              }}
            >
              {props.body}
            </Text>
          </View>
        </View>
        {props.variant === "correct" ? (
          <KitButton label={props.continueLabel ?? "Continue"} onPress={props.onContinue} />
        ) : (
          <View style={{ flexDirection: "row", gap: space["2"] }}>
            <View style={{ flex: 1 }}>
              <KitButton label="Try again" variant="accent" onPress={props.onTryAgain} />
            </View>
            {props.onShowMe ? (
              <View style={{ flex: 1 }}>
                <KitButton label="Show me" variant="outline" onPress={props.onShowMe} />
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}
