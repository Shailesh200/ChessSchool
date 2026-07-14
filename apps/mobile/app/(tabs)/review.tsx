import { useEffect, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useProgress, mutateProgress, fetchProgress } from "@/progressStore";
import { markHomeworkActivity } from "@/homeworkRoutine";
import { isoDay } from "@/progression";
import { api } from "@/api";
import { Cody } from "@/Cody";
import { Icon } from "@/Icon";
import { emojiToIcon } from "@/iconMaps";
import { Button } from "@/Button";
import { ThemedSafeArea } from "@/ThemedSafeArea";
import { useAppTheme } from "@/ThemeProvider";
import { movesFromSyncGame, normalizeSyncGame, playerResultOf } from "@/progression";
import { font, radius, shadowCard, space, type } from "@/theme";

type RecommendLesson = { id: string; title: string; emoji: string; tag: string };

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
        recCard: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, borderWidth: 1, borderColor: colors.accent, padding: space[4], ...shadowCard },
        recEyebrow: { ...type.caption, fontFamily: font.bold, color: colors.accent, textTransform: "uppercase", letterSpacing: 0.5 },
        recTitle: { ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[1] },
        recButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space[2], backgroundColor: colors.brand, borderRadius: radius.pill, paddingVertical: 14, paddingHorizontal: space[4] },
        recButtonText: { ...type.sm, fontFamily: font.bold, color: "#fff" },
        badge: { borderRadius: radius.pill, paddingHorizontal: space[3], paddingVertical: 5 },
        badgeText: { fontFamily: font.bold, fontSize: 12 },
        title: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.xs, fontFamily: font.medium, color: colors.ink500, marginTop: 1 },
      }),
    [colors],
  );

  const progress = useProgress();
  const [suggestion, setSuggestion] = useState<RecommendLesson | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const weaknesses = (progress?.weaknesses ?? {}) as Record<string, number>;
  const topTag = useMemo(
    () => Object.entries(weaknesses).sort((a, b) => b[1] - a[1])[0]?.[0],
    [weaknesses],
  );

  useEffect(() => {
    if (!topTag) {
      setSuggestion(null);
      return;
    }
    void api<{ lesson: RecommendLesson | null }>(`/api/recommend-lesson?tag=${encodeURIComponent(topTag)}`)
      .then((d) => setSuggestion(d.lesson))
      .catch(() => setSuggestion(null));
  }, [topTag]);
  const games = useMemo(
    () => ((progress?.recentGames as unknown[]) ?? []).map(normalizeSyncGame).filter((g): g is NonNullable<typeof g> => g !== null),
    [progress],
  );

  useEffect(() => {
    void mutateProgress((snap) => markHomeworkActivity(snap, "review", isoDay()));
  }, []);

  const END_LABEL: Record<string, string> = {
    checkmate: "Checkmate",
    resign: "Resigned",
    timeout: "On time",
    draw: "Draw",
    stalemate: "Stalemate",
  };

  const RESULT = {
    win: { label: "Win", color: colors.success },
    loss: { label: "Loss", color: colors.danger },
    draw: { label: "Draw", color: colors.ink500 },
    resign: { label: "Resigned", color: colors.warning },
  };

  function outcome(g: (typeof games)[number]): keyof typeof RESULT {
    if (g.endReason === "resign" && g.mode === "bot") return "resign";
    const pr = playerResultOf(g, "w");
    if (pr === "draw") return "draw";
    return pr;
  }

  return (
    <ThemedSafeArea edges={["top"]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void fetchProgress(true).finally(() => setRefreshing(false));
            }}
            tintColor={colors.brand}
          />
        }
      >
        <View style={styles.header}>
          <Cody expression="think" size={56} />
          <View style={{ flex: 1 }}>
            <Text style={styles.h1}>Review</Text>
            <Text style={styles.subtitle}>Replay every game and learn from it.</Text>
          </View>
        </View>

        {suggestion && topTag && (
          <View style={styles.recCard}>
            <Text style={styles.recEyebrow}>Recommended class</Text>
            <Text style={styles.recTitle}>
              You&apos;ve been slipping on <Text style={{ color: colors.accent }}>{topTag}</Text>.
            </Text>
            <View style={{ marginTop: space[3] }}>
              <Pressable
                style={styles.recButton}
                onPress={() => router.push({ pathname: "/lesson/[id]", params: { id: suggestion.id } })}
              >
                <Icon name={emojiToIcon(suggestion.emoji)} size={18} color="#fff" duotone />
                <Text style={styles.recButtonText}>Review {suggestion.title}</Text>
              </Pressable>
            </View>
          </View>
        )}

        <Text style={styles.h2}>Match history</Text>
        {games.length === 0 ? (
          <View style={styles.emptyCard}>
            <Icon name="journal" size={32} color={colors.ink300} />
            <Text style={styles.emptyTitle}>No games yet</Text>
            <Text style={styles.emptyText}>Play a match and it'll appear here with a full replay.</Text>
            <View style={{ marginTop: space[3], width: 200 }}>
              <Button label="Play a match" onPress={() => router.push("/play")} />
            </View>
          </View>
        ) : (
          games.map((g, i) => {
            const o = outcome(g);
            const r = RESULT[o];
            const title = g.mode === "pass" ? "vs Human" : g.mode === "online" ? "vs Friend (online)" : `vs Bot · ${g.elo ?? "?"}`;
            const moveCount = g.moveCount || movesFromSyncGame(g).length;
            const date = new Date(g.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
            const endLabel = g.endReason ? END_LABEL[g.endReason] ?? g.endReason : null;
            return (
              <Pressable
                key={g.id}
                testID={`game-${g.id}`}
                style={styles.card}
                onPress={() => router.push({ pathname: "/replay/[index]", params: { index: "0", id: g.id } })}
              >
                <View style={[styles.badge, { backgroundColor: r.color + "22" }]}>
                  <Text style={[styles.badgeText, { color: r.color }]}>{r.label}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.title}>{title}</Text>
                  <Text style={styles.sub}>
                    {date} · {moveCount} moves{endLabel ? ` · ${endLabel}` : ""}
                  </Text>
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
