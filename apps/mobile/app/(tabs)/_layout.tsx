import { Tabs } from "expo-router";
import { Pressable } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { Icon, type IconName } from "@/Icon";
import { useAppTheme } from "@/ThemeProvider";
import { font } from "@/theme";

function tabIcon(name: IconName) {
  return ({ color }: { color: string }) => <Icon name={name} size={24} color={color} duotone />;
}

function tabButton(testID: string) {
  return ({ ref: _ref, ...props }: BottomTabBarButtonProps) => (
    <Pressable {...props} testID={testID} accessibilityRole="tab" />
  );
}

export default function TabsLayout() {
  const { colors } = useAppTheme();
  return (
    <Tabs
      initialRouteName="academy"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink300,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surfaceCard, borderTopColor: colors.hairline },
      }}
    >
      <Tabs.Screen
        name="academy"
        options={{ title: "Academy", tabBarIcon: tabIcon("learn"), tabBarButton: tabButton("tab-Academy") }}
      />
      <Tabs.Screen name="play" options={{ title: "Play", tabBarIcon: tabIcon("play"), tabBarButton: tabButton("tab-Play") }} />
      <Tabs.Screen
        name="review"
        options={{ title: "Review", tabBarIcon: tabIcon("review"), tabBarButton: tabButton("tab-Review") }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: "Profile", tabBarIcon: tabIcon("cap"), tabBarButton: tabButton("tab-Profile") }}
      />
    </Tabs>
  );
}
