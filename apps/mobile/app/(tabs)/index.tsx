import { useMemo } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/auth";
import { Cody } from "@/Cody";
import { Icon, type IconName } from "@/Icon";
import { Button } from "@/Button";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, space, type } from "@/theme";

const FEATURES: { icon: IconName; title: string; body: string }[] = [
  { icon: "learn", title: "Structured curriculum", body: "Graduate through schools, semesters, and classes." },
  { icon: "target", title: "FEN-verified puzzles", body: "Thousands of rated tactics tagged by concept." },
  { icon: "play", title: "Play vs bots", body: "Adaptive AI, clocks, and match review." },
  { icon: "bulb", title: "Assisted play", body: "Coach explains every move at your level." },
];

function FeatureBadge({ name, colors }: { name: IconName; colors: ReturnType<typeof useAppTheme>["colors"] }) {
  return (
    <View
      style={{
        width: 44,
        height: 44,
        borderRadius: radius.card,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.brand50,
        borderWidth: 1,
        borderColor: colors.brand100,
      }}
    >
      <Icon name={name} size={22} color={colors.brand} duotone />
    </View>
  );
}

export default function HomeLandingScreen() {
  const { guest } = useAuth();
  const router = useRouter();
  const { colors } = useAppTheme();

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], paddingBottom: 48, gap: space[5] },
        hero: { flexDirection: "row", alignItems: "center", gap: space[3] },
        kicker: { ...type.xs, fontFamily: font.bold, color: colors.brand, textTransform: "uppercase", letterSpacing: 0.6 },
        title: { ...type.xl, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
        body: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: space[2], lineHeight: 22 },
        card: {
          flexDirection: "row",
          alignItems: "flex-start",
          gap: space[3],
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[4],
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        cardTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        cardBody: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 4, flex: 1 },
        statRow: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
        stat: {
          flexGrow: 1,
          minWidth: "45%",
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[3],
          alignItems: "center",
          gap: space[2],
          borderWidth: 1,
          borderColor: colors.hairline,
        },
        statNum: { ...type.lg, fontFamily: font.bold, color: colors.ink },
        statLabel: { ...type.xs, fontFamily: font.bold, color: colors.ink500 },
        ctaRow: { gap: space[2] },
      }),
    [colors],
  );

  const stats: { icon: IconName; label: string; value: string }[] = [
    { icon: "cap", label: "Schools", value: "7" },
    { icon: "learn", label: "Lessons", value: "1,600+" },
    { icon: "trophy", label: "Free", value: "Forever" },
    { icon: "sparkle", label: "Offline", value: "PWA" },
  ];

  return (
    <ThemedSafeArea edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content}>
        <View>
          <Text style={styles.kicker}>Free online chess academy</Text>
          <View style={styles.hero}>
            <Cody expression="wave" size={72} />
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>Learn chess like a real school</Text>
            </View>
          </View>
          <Text style={styles.body}>
            Structured classes, coach narration, bot play, arena tournaments, and live multiplayer —
            free on web and app. {guest ? "Enroll to save progress across devices." : "Continue your journey on campus."}
          </Text>
        </View>

        <View style={styles.statRow}>
          {stats.map((s) => (
            <View key={s.label} style={styles.stat}>
              <FeatureBadge name={s.icon} colors={colors} />
              <Text style={styles.statNum}>{s.value}</Text>
              <Text style={styles.statLabel}>{s.label}</Text>
            </View>
          ))}
        </View>

        {FEATURES.map((f) => (
          <View key={f.title} style={styles.card}>
            <FeatureBadge name={f.icon} colors={colors} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>{f.title}</Text>
              <Text style={styles.cardBody}>{f.body}</Text>
            </View>
          </View>
        ))}

        <View style={styles.ctaRow}>
          <Button label="Continue to academy →" onPress={() => router.push("/(tabs)/academy")} />
          {guest && (
            <Button label="Enroll free" variant="outline" onPress={() => router.push("/login")} />
          )}
        </View>
      </ScrollView>
    </ThemedSafeArea>
  );
}
