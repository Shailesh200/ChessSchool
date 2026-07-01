import { StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useMemo, type ReactNode } from "react";
import { useAppTheme } from "./ThemeProvider";

type Props = {
  children: ReactNode;
  edges?: Edge[];
  style?: StyleProp<ViewStyle>;
};

/** SafeAreaView that re-renders when the app theme palette changes. */
export function ThemedSafeArea({ children, edges = ["top"], style }: Props) {
  const { colors } = useAppTheme();
  const base = useMemo(() => ({ flex: 1, backgroundColor: colors.surface }), [colors.surface]);
  return (
    <SafeAreaView style={[base, style]} edges={edges}>
      {children}
    </SafeAreaView>
  );
}

/** Build StyleSheet from live theme colors — call inside a component. */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (colors: ReturnType<typeof useAppTheme>["colors"]) => T): T {
  const { colors } = useAppTheme();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}
