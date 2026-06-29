import { Tabs } from "expo-router";
import { Icon, type IconName } from "@/Icon";
import { colors, font } from "@/theme";

function tabIcon(name: IconName) {
  return ({ color }: { color: string }) => <Icon name={name} size={24} color={color} duotone />;
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.ink300,
        tabBarLabelStyle: { fontFamily: font.semibold, fontSize: 11 },
        tabBarStyle: { backgroundColor: colors.surfaceCard, borderTopColor: colors.hairline },
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Learn", tabBarIcon: tabIcon("learn") }} />
      <Tabs.Screen name="play" options={{ title: "Play", tabBarIcon: tabIcon("play") }} />
      <Tabs.Screen name="review" options={{ title: "Review", tabBarIcon: tabIcon("review") }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: tabIcon("cap") }} />
    </Tabs>
  );
}
