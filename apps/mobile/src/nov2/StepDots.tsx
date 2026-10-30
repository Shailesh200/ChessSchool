import { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { usePremiumKitTheme } from "@/components/kit";
import { createStepDotStyles } from "./boaKitStyles";

/** Step indicator — 4 dots with accent pill on active step. */
export function StepDots({ step, total = 4 }: { step: number; total?: number }) {
  const kit = usePremiumKitTheme();
  const styles = useMemo(() => createStepDotStyles(kit), [kit]);

  return (
    <View style={styles.row} accessibilityLabel={`Step ${step + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => {
        const on = i === step;
        const done = i < step;
        return <View key={i} style={[styles.dot, on && styles.on, done && styles.done, on && { width: 26 }]} />;
      })}
    </View>
  );
}
