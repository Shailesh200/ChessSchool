import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/api";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { Button } from "@/Button";
import { TopBar } from "@/TopBar";
import { colors, font, radius, shadowCard, space, type } from "@/theme";

type Game = { moves: string[]; result: "win" | "loss" | "draw"; elo: number; at: number };
const RESULT = {
  win: { label: "Win", color: colors.success },
  loss: { label: "Loss", color: colors.danger },
  draw: { label: "Draw", color: colors.ink500 },
};

export default function ReviewScreen() {
  const router = useRouter();
  const [games, setGames] = useState<Game[]>([]);

  useFocusEffect(
    useCallback(() => {
      api<{ recentGames: Game[] }>("/api/progress")
        .then((d) => setGames(d.recentGames ?? []))
        .catch(() => void 0);
    }, []),
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
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
            const r = RESULT[g.result];
            return (
              <Pressable
                key={i}
                testID={`game-${i}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/replay/[index]", params: { index: String(i) } })}
              >
                <View style={[styles.badge, { backgroundColor: r.color + "22" }]}>
                  <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>vs Bot · {g.elo}</Text>
                  <Text style={styles.sub}>{g.moves.length} moves</Text>
                </View>
                <Icon name="chevronRight" size={18} color={colors.ink300} />
              </Pressable>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
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
});
