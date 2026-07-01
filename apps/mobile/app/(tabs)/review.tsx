import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useMemo } from "react";
import { useProgress } from "@/progressStore";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { TopBar } from "@/TopBar";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { movesFromSyncGame, normalizeSyncGame, playerResultOf } from "@/progression";
import { font, radius, shadowCard, space, type } from "@/theme";

export default function ReviewScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[5] },
        header: { flexDirection: "row", alignItems: "center", gap: space[3] },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        subtitle: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, marginTop: 1 },
        h2: { ...type.base, fontFamily: font.bold, color: colors.ink, marginBottom: -space[2] },
        emptyCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[5], alignItems: "center", ...shadowCard },
        emptyTitle: { ...type.base, fontFamily: font.bold, color: colors.ink, marginTop: space[2] },
        emptyText: { textAlign: "center", marginTop: space[1], ...type.xs, fontFamily: font.semibold, color: colors.ink500, lineHeight: 18 },
        card: { flexDirection: "row", alignItems: "center", gap: space[3], backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: space[3], ...shadowCard },
        badge: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 5 },
        badgeText: { fontFamily: font.bold, fontSize: 12 },
        title: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
      }),
    [colors],
  );

  const progress = useProgress();
  const games = useMemo(
    () => ((progress?.recentGames as unknown[]) ?? []).map(normalizeSyncGame).filter((g): g is NonNullable<typeof g> => g !== null),
    [progress],
  );

  const RESULT = {
    win: { label: "Win", color: colors.success },
    loss: { label: "Loss", color: colors.danger },
    draw: { label: "Draw", color: colors.ink500 },
  };

  return (
    <ThemedSafeArea edges={["top"]}>
      <TopBar />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Cody expression="think" size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Review</Text>
            <Text style={styles.subtitle}>Replay every game and learn from it.</Text>
          </View>
        </View>

        <Text style={styles.h2}>Match history</Text>
        {games.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={{ fontSize: 32 }}>📋</Text>
            <Text style={styles.emptyTitle}>No games yet</Text>
            <Text style={styles.emptyText}>Play a match and it'll appear here with a full replay.</Text>
            <View style={{ marginTop: space[3], width: 200 }}>
              <Button label="Play a match" onPress={() => router.push("/play")} />
            </View>
          </View>
        ) : (
          games.map((g, i) => {
            const pr = playerResultOf(g, "w");
            const r = RESULT[pr];
            const title = g.mode === "pass" ? "vs Human" : g.mode === "online" ? "vs Friend (online)" : `vs Bot · ${g.elo ?? "?"}`;
            const moveCount = g.moveCount || movesFromSyncGame(g).length;
            return (
              <Pressable
                key={g.id}
                testID={`game-${i}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/replay/[index]", params: { index: String(i) } })}
              >
                <View style={[styles.badge, { backgroundColor: r.color + "22" }]}>
                  <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.sub}>{moveCount} moves</Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.ink300} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </ThemedSafeArea>
  );
}
