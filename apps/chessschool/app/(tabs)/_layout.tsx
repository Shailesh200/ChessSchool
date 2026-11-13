import { copy, type IconName } from "@chessschool/design";
import { Tabs } from "expo-router";
import { Pressable, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "@/components/Icon";
import { T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

const ICONS: Record<string, IconName> = { today: "learn", puzzles: "puzzle", gym: "gym", you: "profile" };
const LABELS: Record<string, string> = { today: copy.tabs.today, puzzles: copy.tabs.puzzles, gym: copy.tabs.gym, you: copy.tabs.you };

export default function TabsLayout() {
  const { c } = useTheme();
  const { cue } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: c.bg } }}
      tabBar={({ state, navigation }) => (
        <View
          accessibilityRole="tablist"
          style={{ flexDirection: "row", paddingHorizontal: 8, paddingTop: 6, paddingBottom: Math.max(insets.bottom, 8), backgroundColor: c.card, borderTopWidth: 1, borderTopColor: c.line }}
        >
          {state.routes.map((route, i) => {
            const focused = state.index === i;
            return (
              <Pressable
                key={route.key}
                accessibilityRole="tab"
                accessibilityLabel={LABELS[route.name]}
                accessibilityState={{ selected: focused }}
                onPress={() => {
                  const e = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
                  if (!focused && !e.defaultPrevented) {
                    cue("tap");
                    navigation.navigate(route.name);
                  }
                }}
                style={{ flex: 1, minHeight: 60, alignItems: "center", justifyContent: "center", gap: 2 }}
              >
                <View style={{ width: 56, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", backgroundColor: focused ? c.brandSoft : "transparent" }}>
                  <Icon name={ICONS[route.name]} color={focused ? c.brandText : c.textMuted} />
                </View>
                <T role="micro" style={{ color: focused ? c.brandText : c.textMuted, fontSize: 13 }}>
                  {LABELS[route.name]}
                </T>
              </Pressable>
            );
          })}
        </View>
      )}
    >
      <Tabs.Screen name="today" />
      <Tabs.Screen name="puzzles" />
      <Tabs.Screen name="gym" />
      <Tabs.Screen name="you" />
    </Tabs>
  );
}
