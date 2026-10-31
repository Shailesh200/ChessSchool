import { StyleSheet, Text, View } from "react-native";
import { premiumColors, premiumFont } from "./premiumTokens";

/** Premium wordmark text lockup (matches design `.wm`). */
export function PremiumWordmark({ compact }: { compact?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="image" accessibilityLabel="ChessSchool">
      <Text style={[styles.wm, compact && styles.compact]}>
        Chess<Text style={styles.accent}>School</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", justifyContent: "center" },
  wm: {
    fontSize: 28,
    lineHeight: 32,
    fontFamily: premiumFont.display,
    color: premiumColors.brandSoftText,
    letterSpacing: -0.6,
  },
  compact: { fontSize: 22, lineHeight: 26 },
  accent: { color: premiumColors.accentEdge },
});
