import { Pressable, StyleSheet, Text, View } from "react-native";
import { usePathname, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { usePremiumKitTheme } from "./kitThemeContext";
import { KitIcon, type KitIconName } from "./Icon";
import { useProgress } from "@/progressStore";
import { premiumTabActive, reviewDueCount, reviewTabBadge } from "@/screens/premium/aceModel";

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
  return premiumTabActive(pathname, routeName);
}

function ReviewBadge({ count }: { count: number }) {
  const badge = reviewTabBadge(count);
  const { colors, font } = usePremiumKitTheme();
  if (!badge.visible) return null;
  return (
    <View testID="review-tab-badge" style={[styles.badge, { backgroundColor: colors.accent }]}>
      <Text style={{ color: colors.textOnAccent, fontFamily: font.uiBold, fontSize: 10, lineHeight: 12 }}>{badge.label}</Text>
    </View>
  );
}

function TabGlyph({
  tab,
  active,
  due,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
  due: number;
}) {
  const { colors, font, type, space } = usePremiumKitTheme();
  const tint = active ? colors.tabActive : colors.tabInactive;
  return (
    <>
      <View>
        <KitIcon name={tab.icon} size={24} color={tint} />
        {tab.routeName === "review" ? <ReviewBadge count={due} /> : null}
      </View>
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
    </>
  );
}

/** `.tab-bar` — Learn, Play, Review, Profile (Gym under Learn). */
export function KitTabBar(props: BottomTabBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const { colors } = usePremiumKitTheme();
  const due = reviewDueCount(useProgress()?.lessons);

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
        const badge = tab.routeName === "review" ? reviewTabBadge(due) : null;
        return (
          <Pressable
            key={tab.routeName}
            testID={tab.testID}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={badge?.accessibilityLabel ?? tab.label}
            onPress={() => {
              props.navigation.navigate(tab.routeName);
              router.push(tab.href);
            }}
          >
            <TabGlyph tab={tab} active={active} due={due} />
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
  const { colors } = usePremiumKitTheme();
  const due = reviewDueCount(useProgress()?.lessons);

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
        const badge = tab.routeName === "review" ? reviewTabBadge(due) : null;
        return (
          <Pressable
            key={tab.routeName}
            testID={tab.testID}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={badge?.accessibilityLabel ?? tab.label}
            onPress={() => router.push(tab.href)}
          >
            <TabGlyph tab={tab} active={active} due={due} />
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
  badge: {
    position: "absolute",
    top: -4,
    right: -10,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    alignItems: "center",
    justifyContent: "center",
  },
});
