import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { useProgress } from "@/progressStore";
import { AnimatedNumber } from "@/AnimatedNumber";
import { usePremiumKitTheme } from "./kitThemeContext";
import { KitIcon } from "./Icon";
import { KitLogo } from "./Logo";

/** `.topbar` — streak + XP chips only (no hearts/lives). */
export function KitTopBar() {
  const router = useRouter();
  const { guest, exitGuest } = useAuth();
  const { colors, space, radius, font, type } = usePremiumKitTheme();
  const d = useProgress();
  const xp = (d?.xp as number) ?? 0;
  const streak = (d?.streak as number) ?? 0;

  if (guest) {
    return (
      <View
        style={[
          styles.bar,
          styles.wrapRow,
          { backgroundColor: colors.surface, borderBottomColor: colors.hairline, paddingHorizontal: space["4"] },
        ]}
      >
        <View style={styles.brandRow}>
          <KitLogo size={28} />
        </View>
        <Pressable
          accessibilityRole="button"
          style={[styles.enroll, { backgroundColor: colors.brand, borderRadius: radius.pill, paddingHorizontal: space["3"] }]}
          onPress={() => {
            exitGuest();
            router.push("/login");
          }}
        >
          <Text style={{ fontFamily: font.displayBold, fontSize: type.xs.fontSize, color: "#fff" }}>Enroll</Text>
          <KitIcon name="chevronRight" size={14} color="#fff" />
        </Pressable>
      </View>
    );
  }

  return (
    <View
      style={[
        styles.bar,
        styles.wrapRow,
        {
          backgroundColor: colors.surface,
          borderBottomColor: colors.hairline,
          paddingHorizontal: space["4"],
          gap: space["3"],
        },
      ]}
    >
      <View
        style={[
          styles.chip,
          {
            backgroundColor: colors.chipStreakBg,
            borderRadius: radius.pill,
            paddingHorizontal: space["3"],
            paddingVertical: space["1.5"],
          },
        ]}
        accessibilityLabel={`Streak ${streak} days`}
      >
        <KitIcon name="flame" size={18} color={colors.chipStreakInk} />
        <AnimatedNumber
          value={streak}
          style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.chipStreakInk }}
        />
      </View>
      <View
        style={[
          styles.chip,
          styles.xpChip,
          {
            backgroundColor: colors.chipXpBg,
            borderRadius: radius.pill,
            paddingHorizontal: space["3"],
            paddingVertical: space["1.5"],
          },
        ]}
        accessibilityLabel={`${xp} experience points`}
      >
        <KitIcon name="sparkles" size={16} color={colors.chipXpInk} />
        <AnimatedNumber
          value={xp}
          style={{ fontFamily: font.displayBold, fontSize: type.sm.fontSize, color: colors.chipXpInk }}
        />
        <Text style={{ fontFamily: font.displaySemibold, fontSize: type.xs.fontSize, color: colors.chipXpInk }}>XP</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  wrapRow: { flexWrap: "wrap", rowGap: 4 },
  brandRow: { flexDirection: "row", alignItems: "center", flexShrink: 1, minWidth: 0 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1, minWidth: 0 },
  xpChip: { marginLeft: "auto" },
  enroll: { flexDirection: "row", alignItems: "center", gap: 2, paddingVertical: 7, flexShrink: 0 },
});
