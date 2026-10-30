import { StyleSheet, View } from "react-native";
import { premiumColors, premiumRadius } from "./premiumTokens";

/** Step indicator — 4 dots with accent pill on active step. */
export function StepDots({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <View style={styles.row} accessibilityLabel={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const on = i === step;
        const done = i < step;
        return (
          <View
            key={i}
            style={[styles.dot, on && styles.on, done && styles.done, on && { width: 26 }]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", justifyContent: "center", gap: 6, marginVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: premiumRadius.pill, backgroundColor: premiumColors.lineStrong },
  on: { backgroundColor: premiumColors.accent },
  done: { backgroundColor: premiumColors.brand },
});
