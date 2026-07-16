import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";
import { NavProgress } from "./NavProgress";
import { ThemedSafeArea } from "./ThemedSafeArea";

type Props = {
  children: ReactNode;
  /** Hide chrome for immersive match / analysis screens. */
  focus?: boolean;
  showTopBar?: boolean;
  showBottomNav?: boolean;
};

/** Shared chrome — TopBar + optional bottom tabs on stack routes (mirrors web AppShell). */
export function AppShell({ children, focus = false, showTopBar = true, showBottomNav = true }: Props) {
  if (focus) {
    return <View style={styles.focus}>{children}</View>;
  }

  return (
    <ThemedSafeArea edges={["top"]} style={styles.shell}>
      <NavProgress />
      {showTopBar ? <TopBar /> : null}
      <View style={styles.body}>{children}</View>
      {showBottomNav ? <BottomNav /> : null}
    </ThemedSafeArea>
  );
}

const styles = StyleSheet.create({
  shell: { flex: 1 },
  body: { flex: 1 },
  focus: { flex: 1 },
});
