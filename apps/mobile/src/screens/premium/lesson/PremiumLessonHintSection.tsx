import { Pressable, Text, View } from "react-native";
import { KitButton, KitIcon, usePremiumKitTheme } from "@/components/kit";

type Props = {
  hintLevel: number;
  onHintPress: () => void;
  showCheck?: boolean;
  checkDisabled?: boolean;
  onCheck?: () => void;
  turnCue?: string;
};

export function PremiumLessonHintSection({
  hintLevel,
  onHintPress,
  showCheck,
  checkDisabled,
  onCheck,
  turnCue,
}: Props) {
  const { colors, radius, space, font, type } = usePremiumKitTheme();
  const inHintFlow = hintLevel > 0;

  if (inHintFlow) {
    const steps = [
      { n: 1, label: "Nudge", done: hintLevel >= 1 },
      { n: 2, label: "Highlight", done: hintLevel >= 2 },
      { n: 3, label: "Arrow", done: hintLevel >= 3, active: hintLevel === 3 },
    ];
    return (
      <View style={{ paddingHorizontal: space["4"], gap: space["3"], alignItems: "center" }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: space["2"] }}>
          {steps.map((s) => (
            <View
              key={s.n}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
                paddingHorizontal: space["3"],
                paddingVertical: space["1.5"],
                borderRadius: radius.pill,
                backgroundColor: s.active ? colors.accent : s.done ? colors.brand50 : colors.surfaceSunken,
              }}
            >
              {s.done && !s.active ? <KitIcon name="check" size={12} color={colors.brand} /> : null}
              <Text
                style={{
                  fontFamily: font.displaySemibold,
                  fontSize: type.xs.fontSize,
                  color: s.active ? colors.surfaceCard : colors.brand,
                }}
              >
                {s.n} {s.label}
              </Text>
            </View>
          ))}
        </View>
        <View style={{ flexDirection: "row", alignItems: "center", gap: space["2"], paddingHorizontal: space["2"] }}>
          <KitIcon name="info" size={18} color={colors.ink500} />
          <Text
            style={{
              flex: 1,
              fontFamily: font.displayMedium,
              fontSize: type.xs.fontSize,
              lineHeight: type.xs.lineHeight,
              color: colors.ink500,
              textAlign: "center",
            }}
          >
            Hints cost no XP, but they show in your summary
          </Text>
        </View>
        {showCheck ? (
          <KitButton label="Check" disabled={checkDisabled} onPress={() => onCheck?.()} />
        ) : null}
      </View>
    );
  }

  return (
    <View style={{ paddingHorizontal: space["4"], gap: space["2"], alignItems: "center" }}>
      <Pressable
        onPress={onHintPress}
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: space["2"],
          backgroundColor: colors.brand50,
          paddingHorizontal: space["4"],
          paddingVertical: space["2"],
          borderRadius: radius.pill,
        }}
      >
        <KitIcon name="info" size={16} color={colors.brand} />
        <Text style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.brand }}>
          Hint {Math.min(hintLevel + 1, 3)} of 3
        </Text>
      </Pressable>
      {turnCue ? (
        <Text style={{ fontFamily: font.displayMedium, fontSize: type.xs.fontSize, color: colors.ink500 }}>
          {turnCue}
        </Text>
      ) : null}
      {showCheck ? (
        <KitButton label="Check" disabled={checkDisabled} onPress={() => onCheck?.()} />
      ) : null}
    </View>
  );
}
