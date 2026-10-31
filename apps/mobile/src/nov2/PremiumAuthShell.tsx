import { type ReactNode, useMemo } from "react";
import { ScrollView, StyleSheet, View, useColorScheme } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { usePremiumKitTheme } from "@/components/kit";
import { resolvePremiumColorMode } from "@/themeMode";
import { useSettings } from "@/settings";
import { CoachRow } from "./CoachRow";
import { KitLogo } from "@/components/kit";
import { BOA_COLUMN, createBoaAuthStyles } from "./boaKitStyles";
import type { CoachMood } from "./coachArt";

type Props = {
  children: ReactNode;
  coachLine: string;
  coachMood?: CoachMood;
  testID?: string;
};

/** Shared 16-auth / 19a / 19b mobile column (logo + coach + content). */
export function PremiumAuthShell({ children, coachLine, coachMood = "neutral", testID }: Props) {
  const { themeMode } = useSettings();
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createBoaAuthStyles(kit, mode), [kit, mode]);

  return (
    <SafeAreaView style={[styles.safe, BOA_COLUMN]} edges={["top", "bottom"]} testID={testID}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.logoFrame}>
          <KitLogo withText size={24} />
        </View>
        <CoachRow slug="otto" mood={coachMood} text={coachLine} size={64} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SentBox({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  const { themeMode } = useSettings();
  const kit = usePremiumKitTheme();
  const scheme = useColorScheme();
  const mode = resolvePremiumColorMode(themeMode, scheme);
  const styles = useMemo(() => createBoaAuthStyles(kit, mode), [kit, mode]);

  return (
    <View style={styles.sentBox} accessibilityRole="text">
      <View style={styles.sentIconWrap}>{icon}</View>
      {children}
    </View>
  );
}

export { CoachHead } from "./CoachRow";
