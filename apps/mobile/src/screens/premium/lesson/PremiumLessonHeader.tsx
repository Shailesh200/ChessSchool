import { Pressable, Text, View, type ViewStyle } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KitIcon, usePremiumKitTheme } from "@/components/kit";
import { shadowStyle } from "@/theme/premium/mapTokens";

type Props = {
  progressPct: number;
  onClose: () => void;
  style?: ViewStyle;
};

export function PremiumLessonHeader({ progressPct, onClose, style }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const pct = Math.min(100, Math.max(0, progressPct));

  return (
    <View
      style={[
        {
          paddingTop: Math.max(insets.top, space["2"]),
          paddingHorizontal: space["4"],
          paddingBottom: space["2"],
          flexDirection: "row",
          alignItems: "center",
          gap: space["3"],
        },
        style,
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Close lesson"
        onPress={onClose}
        style={[
          shadowStyle("elev-1"),
          {
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: colors.surfaceCard,
            alignItems: "center",
            justifyContent: "center",
            borderWidth: 1,
            borderColor: colors.hairline,
          },
        ]}
      >
        <KitIcon name="x" size={20} color={colors.ink} />
      </Pressable>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        style={{
          flex: 1,
          height: 12,
          borderRadius: radius.pill,
          backgroundColor: colors.surfaceSunken,
          overflow: "hidden",
        }}
      >
        <View
          style={{
            width: `${pct}%`,
            height: 12,
            borderRadius: radius.pill,
            backgroundColor: colors.accent,
          }}
        />
      </View>
      <Text
        style={{
          fontFamily: font.uiBold,
          fontSize: type.caption.fontSize,
          lineHeight: type.caption.lineHeight,
          color: colors.ink500,
          minWidth: 36,
          textAlign: "right",
        }}
      >
        {Math.round(pct)}%
      </Text>
    </View>
  );
}
