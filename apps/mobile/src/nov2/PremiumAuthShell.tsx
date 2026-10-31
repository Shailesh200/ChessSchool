import { type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CoachHead, CoachRow } from "./CoachRow";
import { PremiumWordmark } from "./PremiumWordmark";
import { premiumColors, premiumSpace } from "./premiumTokens";
import type { CoachMood } from "./coachArt";

type Props = {
  children: ReactNode;
  coachLine: string;
  coachMood?: CoachMood;
  testID?: string;
};

/** Shared 16-auth / 19a / 19b mobile column (logo + coach + content). */
export function PremiumAuthShell({ children, coachLine, coachMood = "neutral", testID }: Props) {
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]} testID={testID}>
      <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
        <View style={styles.logoFrame}>
          <PremiumWordmark compact />
        </View>
        <CoachRow slug="otto" mood={coachMood} text={coachLine} size={64} />
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

export function SentBox({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <View style={sentStyles.box} accessibilityRole="text">
      <View style={sentStyles.iconWrap}>{icon}</View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: premiumColors.bg },
  wrap: { padding: premiumSpace[5], gap: premiumSpace[4], paddingBottom: premiumSpace[8] },
  logoFrame: {
    alignSelf: "center",
    backgroundColor: premiumColors.brandSoft,
    borderRadius: 20,
    paddingHorizontal: premiumSpace[5],
    paddingVertical: premiumSpace[3],
  },
});

const sentStyles = StyleSheet.create({
  box: {
    backgroundColor: premiumColors.surfaceSoft,
    borderRadius: 24,
    paddingVertical: 20,
    paddingHorizontal: premiumSpace[4],
    alignItems: "center",
    gap: premiumSpace[2],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: premiumColors.surface,
    alignItems: "center",
    justifyContent: "center",
  },
});

export { CoachHead };
