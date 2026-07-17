import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useProgress } from "./progressStore";
import { useAppTheme } from "./ThemeProvider";
import { font, radius, shadowCard, space, type } from "./theme";

function title(r: number): string {
  if (r >= 2000) return "Master";
  if (r >= 1600) return "Expert";
  if (r >= 1300) return "Advanced";
  if (r >= 1000) return "Intermediate";
  if (r >= 700) return "Improver";
  return "Beginner";
}

export function RatingBadge() {
  const p = useProgress();
  const { colors } = useAppTheme();
  const rating = (p?.rating as number | undefined) ?? 800;
  const styles = useMemo(
    () =>
      StyleSheet.create({
        card: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space[4],
          ...shadowCard,
        },
        label: { ...type.caption, fontFamily: font.bold, color: colors.ink500, textTransform: "uppercase", letterSpacing: 0.5 },
        tier: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
        value: { fontSize: 32, lineHeight: 36, fontFamily: font.bold, color: colors.brand },
      }),
    [colors],
  );

  return (
    <View style={styles.card}>
      <View>
        <Text style={styles.label}>Player strength</Text>
        <Text style={styles.tier}>{title(rating)}</Text>
      </View>
      <Text style={styles.value}>{rating}</Text>
    </View>
  );
}
