import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePremiumKitTheme } from "./kitThemeContext";
import { KitIcon, type KitIconName } from "./Icon";

const TABS: {
  routeName: string;
  href: "/(tabs)/academy" | "/(tabs)/play" | "/(tabs)/review" | "/(tabs)/profile";
  label: "Learn" | "Play" | "Review" | "Profile";
  icon: KitIconName;
  testID: string;
}[] = [
  { routeName: "academy", href: "/(tabs)/academy", label: "Learn", icon: "bookOpen", testID: "tab-Learn" },
  { routeName: "play", href: "/(tabs)/play", label: "Play", icon: "gamepad2", testID: "tab-Play" },
  { routeName: "review", href: "/(tabs)/review", label: "Review", icon: "rotateCcw", testID: "tab-Review" },
  { routeName: "profile", href: "/(tabs)/profile", label: "Profile", icon: "userRound", testID: "tab-Profile" },
];

function isTabActive(pathname: string, routeName: string): boolean {
  if (routeName === "academy") {
    return pathname.includes("academy") || pathname === "/" || pathname.includes("/class/") || pathname.includes("/lesson/");
  }
  if (routeName === "play") return pathname.includes("/(tabs)/play") || pathname === "/play";
  if (routeName === "review") return pathname.includes("/(tabs)/review") || pathname.includes("/replay");
  if (routeName === "profile") return pathname.includes("/(tabs)/profile");
  return false;
}

/** `.tab-bar` — Learn, Play, Review, Profile (Gym under Learn). */
export function KitTabBar(props: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, font, type, space } = usePremiumKitTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.hairline,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.routeName);
        const tint = active ? colors.tabActive : colors.tabInactive;
        return (
          <Pressable
            key={tab.routeName}
            testID={tab.testID}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => {
              props.navigation.navigate(tab.routeName);
              router.push(tab.href);
            }}
          >
            <KitIcon name={tab.icon} size={24} color={tint} />
            <Text
              style={{
                fontFamily: font.displaySemibold,
                fontSize: type.caption.fontSize,
                lineHeight: type.caption.lineHeight,
                color: tint,
                marginTop: space["0.5"],
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Standalone tab bar for stack routes (AppShell). */
export function KitBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors, font, type, space } = usePremiumKitTheme();

  return (
    <View
      style={[
        styles.bar,
        {
          paddingBottom: Math.max(insets.bottom, 8),
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.hairline,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = isTabActive(pathname, tab.routeName);
        const tint = active ? colors.tabActive : colors.tabInactive;
        return (
          <Pressable
            key={tab.routeName}
            testID={tab.testID}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => router.push(tab.href)}
          >
            <KitIcon name={tab.icon} size={24} color={tint} />
            <Text
              style={{
                fontFamily: font.displaySemibold,
                fontSize: type.caption.fontSize,
                lineHeight: type.caption.lineHeight,
                color: tint,
                marginTop: space["0.5"],
              }}
            >
              {tab.label}
            </Text>
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
    paddingVertical: 4,
  },
});
