import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { normalizeSyncGame } from "@chess-school/progression";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import { progressStore, useProgress } from "@/progressStore";
import { shadowFromGame } from "@/shadow";
import { startShadowMatch } from "@/matchStore";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";

function outcomeLabel(g: { whiteName: string; blackName: string; winner?: "w" | "b" | null }): string {
  if (g.winner === "w") return g.whiteName === "You" ? "Win" : "Loss";
  if (g.winner === "b") return g.blackName === "You" ? "Win" : "Loss";
  return "Draw";
}

export default function ShadowPlayScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const progress = useProgress();
  const [loading, setLoading] = useState(true);

  const games = useMemo(() => {
    const fromProgress = ((progress?.recentGames as unknown[]) ?? [])
      .map(normalizeSyncGame)
      .filter((g): g is NonNullable<typeof g> => g !== null && Boolean(g.pgn?.trim()) && g.moveCount >= 2);
    return fromProgress;
  }, [progress]);

  useEffect(() => {
    void (async () => {
      if (!games.length) {
        const cached = await progressStore.loadCachedGames();
        if (cached?.length && !progressStore.get()?.recentGames) {
          progressStore.set({ ...(progressStore.get() ?? {}), recentGames: cached });
        }
      }
      setLoading(false);
    })();
  }, [games.length]);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[4], paddingBottom: 100 },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, lineHeight: 20 },
        card: {
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.card,
          padding: space[4],
          borderWidth: 1,
          borderColor: colors.hairline,
          ...shadowCard,
        },
        title: { ...type.sm, fontFamily: font.bold, color: colors.ink },
        meta: { ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 2 },
        actions: { flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] },
      }),
    [colors],
  );

  function begin(gameId: string, flipColor: boolean) {
    const game = games.find((g) => g.id === gameId);
    if (!game) return;
    const shadow = shadowFromGame(game, { flipColor });
    if (!shadow) return;
    haptics.success();
    sfx.play("unlock");
    startShadowMatch(shadow);
    router.push("/play/shadow-game");
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton label="Play" />
        <Text style={styles.h1}>Shadow opponent</Text>
        <Text style={styles.sub}>
          Replay a past game — you keep your seat, the opponent&apos;s moves play automatically from that game.
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.brand} style={{ marginTop: 40 }} />
        ) : games.length === 0 ? (
          <View style={styles.card}>
            <Text style={styles.sub}>Play a match first — finished games appear here for shadow rematches.</Text>
            <View style={{ marginTop: space[3], width: 180 }}>
              <Button label="New match" size="sm" onPress={() => router.push("/(tabs)/play")} />
            </View>
          </View>
        ) : (
          games.slice(0, 40).map((g) => (
            <View key={g.id} style={styles.card}>
              <Text style={styles.title} numberOfLines={1}>
                {g.whiteName} vs {g.blackName}
              </Text>
              <Text style={styles.meta}>
                {outcomeLabel(g)} · {g.moveCount} moves · {new Date(g.updatedAt).toLocaleDateString()}
              </Text>
              <View style={styles.actions}>
                <Button label="Same seat" size="sm" block={false} onPress={() => begin(g.id, false)} />
                <Button label="Swap sides" size="sm" variant="outline" block={false} onPress={() => begin(g.id, true)} />
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </AppShell>
  );
}
