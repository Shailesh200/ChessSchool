import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "./Icon";
import { useAppTheme } from "./ThemeProvider";
import { useType } from "./typography";
import { font } from "./theme";

const TABS: { href: "/(tabs)/academy" | "/(tabs)/play" | "/(tabs)/review" | "/(tabs)/profile"; label: string; icon: IconName }[] = [
  { href: "/(tabs)/academy", label: "Academy", icon: "learn" },
  { href: "/(tabs)/play", label: "Play", icon: "play" },
  { href: "/(tabs)/review", label: "Review", icon: "review" },
  { href: "/(tabs)/profile", label: "Profile", icon: "cap" },
];

function isTabActive(pathname: string, href: string): boolean {
  if (href.includes("academy")) {
    return pathname.includes("academy") || pathname === "/" || pathname.includes("/class/") || pathname.includes("/lesson/");
  }
  if (href.includes("play")) return pathname.includes("/(tabs)/play") || pathname === "/play";
  if (href.includes("review")) return pathname.includes("/(tabs)/review") || pathname.includes("/replay");
  if (href.includes("profile")) return pathname.includes("/(tabs)/profile");
  return false;
}

export function BottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = useAppTheme();
  const type = useType();
  const labelSize = type.caption.fontSize;

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.surfaceCard,
          borderTopColor: colors.hairline,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.href);
        const tint = active ? colors.brand : colors.ink300;
        return (
          <Pressable
            key={tab.href}
            testID={`tab-${tab.label}`}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => router.push(tab.href)}
          >
            <Icon name={tab.icon} size={24} color={tint} duotone />
            <Text style={[styles.label, { color: tint, fontSize: labelSize, lineHeight: type.caption.lineHeight }]}>{tab.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 2,
    paddingVertical: 4,
  },
  label: {
    fontFamily: font.semibold,
  },
});
