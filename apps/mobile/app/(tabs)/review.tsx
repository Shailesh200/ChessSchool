import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/api";
import { Icon } from "@/Icon";
import { TopBar } from "@/TopBar";
import { colors, font, radius, shadowCard } from "@/theme";

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
        <Text style={styles.h1}>Review</Text>
        {games.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="review" size={42} color={colors.ink300} />
            <Text style={styles.emptyText}>No games yet — play a match and it'll appear here to replay.</Text>
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
  content: { padding: 20 },
  h1: { fontSize: 22, fontFamily: font.bold, color: colors.ink, marginBottom: 14 },
  empty: { alignItems: "center", marginTop: 60, paddingHorizontal: 30 },
  emptyText: { textAlign: "center", marginTop: 12, fontSize: 14, fontFamily: font.medium, color: colors.ink500, lineHeight: 20 },
  card: { flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: colors.surfaceCard, borderRadius: radius.md, padding: 14, marginBottom: 8, ...shadowCard },
  badge: { borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 5 },
  badgeText: { fontFamily: font.bold, fontSize: 12 },
  title: { fontSize: 15, fontFamily: font.bold, color: colors.ink },
  sub: { fontSize: 12, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
});
