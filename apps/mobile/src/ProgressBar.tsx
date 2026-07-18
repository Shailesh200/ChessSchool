import { View } from "react-native";
import { useAppTheme } from "./ThemeProvider";
import { radius, space } from "./theme";

/** Web `components/ui/ProgressBar` — pill track h-3 (12px). */
export function ProgressBar({
  value,
  max = 1,
  tone = "brand",
  height = 12,
}: {
  value: number;
  max?: number;
  tone?: "brand" | "success" | "accent" | "gold";
  height?: number;
}) {
  const { colors } = useAppTheme();
  const pct = Math.max(0, Math.min(100, max === 0 ? 0 : (value / max) * 100));
  const fill =
    tone === "success"
      ? colors.success
      : tone === "accent"
        ? colors.accent
        : tone === "gold"
          ? colors.gold
          : colors.brand;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(pct) }}
      style={{
        height,
        borderRadius: radius.pill,
        backgroundColor: colors.surfaceSunken,
        overflow: "hidden",
        marginTop: space[1],
      }}
    >
      <View style={{ width: `${pct}%`, height: "100%", borderRadius: radius.pill, backgroundColor: fill }} />
    </View>
  );
}
