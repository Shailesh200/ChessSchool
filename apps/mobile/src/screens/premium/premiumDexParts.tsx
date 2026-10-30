import { Image, Pressable, Text, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { KitIcon, type KitIconName, usePremiumKitTheme } from "@/components/kit";

export function PremiumPageHead({
  title,
  onBack,
  backLabel = "Back",
}: {
  title: string;
  onBack?: () => void;
  backLabel?: string;
}) {
  const { colors, font, type, space } = usePremiumKitTheme();
  return (
    <View style={{ marginTop: space["2"] }}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          style={{ flexDirection: "row", alignItems: "center", gap: space["1"], marginBottom: space["2"] }}
        >
          <KitIcon name="chevronLeft" size={22} color={colors.ink} />
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.sm.fontSize, color: colors.ink }}>{backLabel}</Text>
        </Pressable>
      ) : null}
      <Text
        style={{
          fontFamily: font.displayBold,
          fontSize: type.h2.fontSize,
          lineHeight: type.h2.lineHeight,
          color: colors.ink,
          letterSpacing: -0.3,
        }}
      >
        {title}
      </Text>
    </View>
  );
}

export function PremiumGroupLabel({ children }: { children: string }) {
  const { colors, font, type, space } = usePremiumKitTheme();
  return (
    <Text
      style={{
        fontFamily: font.uiBold,
        fontSize: type.overline.fontSize,
        lineHeight: type.overline.lineHeight,
        color: colors.ink500,
        letterSpacing: 1.2,
        textTransform: "uppercase",
        marginTop: space["5"],
        marginBottom: space["2"],
      }}
    >
      {children}
    </Text>
  );
}

export function PremiumSegment<T extends string>({
  options,
  value,
  onChange,
  testPrefix,
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (id: T) => void;
  testPrefix?: string;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        flexWrap: "wrap",
        gap: space["1"],
        backgroundColor: colors.surfaceMuted,
        borderRadius: radius.md,
        padding: space["1"],
      }}
    >
      {options.map((opt) => {
        const on = opt.id === value;
        return (
          <Pressable
            key={opt.id}
            testID={testPrefix ? `${testPrefix}-${opt.id}` : undefined}
            onPress={() => onChange(opt.id)}
            style={{
              flexGrow: 1,
              minWidth: "30%",
              paddingVertical: space["2"],
              paddingHorizontal: space["2"],
              borderRadius: radius.sm,
              backgroundColor: on ? colors.surfaceCard : "transparent",
              alignItems: "center",
            }}
          >
            <Text
              style={{
                fontFamily: font.uiBold,
                fontSize: type.caption.fontSize,
                color: on ? colors.brand : colors.ink500,
              }}
            >
              {opt.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function PremiumToggleRow({
  label,
  hint,
  value,
  onValueChange,
  testID,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  testID?: string;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <Pressable
      testID={testID}
      onPress={() => onValueChange(!value)}
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      style={{
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: space["3"],
        gap: space["3"],
      }}
    >
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>{label}</Text>
        {hint ? (
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, marginTop: 2 }}>
            {hint}
          </Text>
        ) : null}
      </View>
      <View
        style={{
          width: 52,
          height: 32,
          borderRadius: radius.pill,
          backgroundColor: value ? colors.brand : colors.toggleOff,
          padding: 3,
          justifyContent: "center",
          alignItems: value ? "flex-end" : "flex-start",
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: colors.surfaceCard,
          }}
        />
      </View>
    </Pressable>
  );
}

export function PremiumNavRow({
  icon,
  title,
  subtitle,
  onPress,
  testID,
}: {
  icon: KitIconName;
  title: string;
  subtitle?: string;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space["3"],
        backgroundColor: colors.surfaceCard,
        borderRadius: radius.lg,
        padding: space["4"],
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: radius.md,
          backgroundColor: colors.brand50,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <KitIcon name={icon} size={22} color={colors.brand} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>{title}</Text>
        {subtitle ? (
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, marginTop: 2 }} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <KitIcon name="chevronRight" size={18} color={colors.ink300} />
    </Pressable>
  );
}

export function PremiumStreakCard({ streak, best }: { streak: number; best: number }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <LinearGradient
      colors={["#FF7A59", "#FFA86B"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{
        borderRadius: radius.lg,
        padding: space["4"],
        flexDirection: "row",
        alignItems: "center",
        gap: space["3"],
        minHeight: 96,
      }}
    >
      <Image
        source={require("../../../assets/kit/accents/acc-streak.webp")}
        style={{ width: 56, height: 56, resizeMode: "contain" }}
        accessibilityIgnoresInvertColors
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.displayBold, fontSize: type.display.fontSize, lineHeight: type.display.lineHeight, color: colors.streakCardText }}>
          {streak}
          <Text style={{ fontFamily: font.uiBold, fontSize: type.h4.fontSize }}> day streak</Text>
        </Text>
        <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.streakCardText, opacity: 0.85, marginTop: 4 }}>
          Best: {best}
        </Text>
      </View>
    </LinearGradient>
  );
}

const WEEK = ["M", "T", "W", "T", "F", "S", "S"] as const;

export function PremiumWeekRow({ doneCount }: { doneCount: number }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const capped = Math.min(Math.max(doneCount, 0), 7);
  return (
    <View
      style={{
        backgroundColor: colors.surfaceCard,
        borderRadius: radius.lg,
        padding: space["4"],
        borderWidth: 1,
        borderColor: colors.hairline,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", gap: space["1"] }}>
        {WEEK.map((label, i) => {
          const done = i < capped;
          return (
            <View key={`${label}-${i}`} style={{ alignItems: "center", flex: 1, gap: space["1"] }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: done ? colors.brand50 : colors.surfaceSunken,
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {done ? <KitIcon name="check" size={14} color={colors.brand} /> : null}
              </View>
              <Text style={{ fontFamily: font.uiBold, fontSize: type.caption.fontSize, color: colors.ink500 }}>{label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function PremiumStats3({ xp, lessons, puzzles }: { xp: number; lessons: number; puzzles: number }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  const items = [
    { value: xp.toLocaleString(), label: "Total XP" },
    { value: String(lessons), label: "Lessons" },
    { value: String(puzzles), label: "Puzzles" },
  ];
  return (
    <View style={{ flexDirection: "row", gap: space["2"] }}>
      {items.map((item) => (
        <View
          key={item.label}
          style={{
            flex: 1,
            backgroundColor: colors.surfaceCard,
            borderRadius: radius.lg,
            paddingVertical: space["3"],
            paddingHorizontal: space["2"],
            alignItems: "center",
            borderWidth: 1,
            borderColor: colors.hairline,
          }}
        >
          <Text style={{ fontFamily: font.displayBold, fontSize: type.h3.fontSize, color: colors.ink }}>{item.value}</Text>
          <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, marginTop: 2, textAlign: "center" }}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function PremiumCoachBubble({ message }: { message: string }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "flex-end", gap: space["2"], marginVertical: space["4"] }}>
      <Image
        source={require("../../../assets/kit/coaches/head-otto-happy.webp")}
        style={{ width: 56, height: 56, resizeMode: "contain" }}
        accessibilityLabel="Otto coach"
      />
      <View
        style={{
          flex: 1,
          backgroundColor: colors.coachBubble,
          borderRadius: radius.lg,
          padding: space["4"],
          borderWidth: 1,
          borderColor: colors.hairline,
        }}
      >
        <Text style={{ fontFamily: font.uiMedium, fontSize: type.base.fontSize, lineHeight: type.base.lineHeight, color: colors.ink }}>
          {message}
        </Text>
      </View>
    </View>
  );
}

export function PremiumNotifyPreview({ timeLabel }: { timeLabel: string }) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: space["3"],
        backgroundColor: colors.surfaceCard,
        borderRadius: radius.lg,
        padding: space["4"],
        borderWidth: 1,
        borderColor: colors.hairline,
        marginTop: space["4"],
      }}
    >
      <Image source={require("../../../assets/kit/coaches/head-otto-happy.webp")} style={{ width: 44, height: 44, resizeMode: "contain" }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: colors.ink }}>ChessSchool · {timeLabel}</Text>
        <Text style={{ fontFamily: font.uiMedium, fontSize: type.caption.fontSize, color: colors.ink500, marginTop: 2 }}>
          Time for one small win. 5 minutes is enough.
        </Text>
      </View>
    </View>
  );
}

export function PremiumTimeChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const { colors, font, type, space, radius } = usePremiumKitTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={{
        paddingHorizontal: space["4"],
        paddingVertical: space["2.5"],
        borderRadius: radius.pill,
        borderWidth: 2,
        borderColor: selected ? colors.brand : colors.hairline,
        backgroundColor: selected ? colors.brand50 : colors.surfaceCard,
      }}
    >
      <Text style={{ fontFamily: font.uiBold, fontSize: type.sm.fontSize, color: selected ? colors.brand : colors.ink }}>{label}</Text>
    </Pressable>
  );
}

export function kitCardStyle(extra?: ViewStyle): ViewStyle {
  return extra ?? {};
}
