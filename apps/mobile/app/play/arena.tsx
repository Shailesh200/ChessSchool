import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { AppShell } from "@/AppShell";
import { BackButton } from "@/BackButton";
import { Button } from "@/Button";
import { BotAvatar } from "@/BotAvatar";
import { haptics } from "@/haptics";
import { sfx } from "@/sfx";
import {
  ARENA_ELO_BANDS,
  arenaGamesPlayed,
  arenaStandings,
  isArenaComplete,
  type ArenaBot,
} from "@/arena";
import {
  abandonArena,
  getArenaRun,
  getNextArenaOpponent,
  hydrateArenaStore,
  startArena,
  subscribeArenaStore,
} from "@/arenaStore";
import { startArenaMatch } from "@/matchStore";
import { useAppTheme } from "@/ThemeProvider";
import { font, radius, shadowCard, space, type } from "@/theme";
import { trackEvent } from "@/productAnalytics/track";

export default function ArenaScreen() {
  const router = useRouter();
  const { colors } = useAppTheme();
  const [run, setRun] = useState(getArenaRun());

  useEffect(() => {
    trackEvent("feature_open", { feature: "arena" });
    void hydrateArenaStore().then(() => setRun(getArenaRun()));
    return subscribeArenaStore(() => setRun(getArenaRun()));
  }, []);

  const runInProgress = Boolean(run && !isArenaComplete(run));
  const standings = run ? arenaStandings(run) : null;
  const next = run ? getNextArenaOpponent() : null;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        content: { padding: space[5], gap: space[4], paddingBottom: 100 },
        h1: { ...type.xl, fontFamily: font.bold, color: colors.ink },
        sub: { ...type.sm, fontFamily: font.semibold, color: colors.ink500, lineHeight: 20 },
        card: { backgroundColor: colors.surfaceCard, borderRadius: radius.card, padding: space[4], ...shadowCard },
        row: {
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingVertical: space[2],
          paddingHorizontal: space[3],
          borderRadius: radius.md,
          marginBottom: space[1],
        },
        rowYou: { backgroundColor: colors.brand50, borderWidth: 1, borderColor: colors.brand100 },
        rowBot: { backgroundColor: colors.surfaceSunken },
        band: {
          width: "47%",
          flexGrow: 1,
          backgroundColor: colors.surfaceCard,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.hairline,
          padding: space[3],
          ...shadowCard,
        },
        bands: { flexDirection: "row", flexWrap: "wrap", gap: space[2] },
      }),
    [colors],
  );

  function launch(opponent: ArenaBot, bandElo: number) {
    if (!run) return;
    haptics.success();
    sfx.play("unlock");
    startArenaMatch(
      { runId: run.id, opponentId: opponent.id, bandElo, opponentName: opponent.name },
      opponent.elo,
    );
    router.push({ pathname: "/play/game", params: { elo: String(opponent.elo), time: "none", arena: "1" } });
  }

  function beginBand(bandElo: number) {
    if (runInProgress) return;
    const created = startArena(bandElo);
    const opp = getNextArenaOpponent();
    if (!opp) return;
    launch(opp, created.bandElo);
  }

  function continueRun() {
    if (!run || !next) return;
    launch(next, run.bandElo);
  }

  return (
    <AppShell>
      <ScrollView contentContainerStyle={styles.content}>
        <BackButton label="Play" />
        <Text style={styles.h1}>Arena tournament</Text>
        <Text style={styles.sub}>Four-bot round robin at your chosen level — climb the standings and earn bonus XP.</Text>

        {runInProgress && run && standings && (
          <View style={styles.card}>
            <Text style={{ ...type.sm, fontFamily: font.bold, color: colors.ink }}>
              Round {arenaGamesPlayed(run) + 1} of {run.opponents.length}
            </Text>
            {next && (
              <Text style={{ ...type.xs, fontFamily: font.semibold, color: colors.ink500, marginTop: 4 }}>
                Next: {next.name} · {next.elo}
              </Text>
            )}
            {standings.map((row, i) => (
              <View key={row.id} style={[styles.row, row.isPlayer ? styles.rowYou : styles.rowBot]}>
                <Text style={{ ...type.sm, fontFamily: font.bold, color: colors.ink }}>
                  {i + 1}. {row.name}
                  {row.isPlayer ? " (you)" : ""}
                </Text>
                <Text style={{ ...type.sm, fontFamily: font.bold, color: colors.ink500 }}>{row.points} pt{row.points === 1 ? "" : "s"}</Text>
              </View>
            ))}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space[2], marginTop: space[3] }}>
              {next ? (
                <Button label={arenaGamesPlayed(run) === 0 ? "Start round 1" : "Next round"} size="sm" block={false} onPress={continueRun} />
              ) : (
                <Button label="View last game" size="sm" block={false} onPress={() => router.push("/(tabs)/play")} />
              )}
              <Button
                label="Abandon run"
                size="sm"
                variant="outline"
                block={false}
                onPress={() => {
                  abandonArena();
                  haptics.tap();
                }}
              />
            </View>
          </View>
        )}

        {!runInProgress && (
          <View style={styles.card}>
            <Text style={{ ...type.sm, fontFamily: font.bold, color: colors.ink, marginBottom: space[2] }}>Choose ELO band</Text>
            <View style={styles.bands}>
              {ARENA_ELO_BANDS.map((elo) => (
                <Pressable key={elo} style={styles.band} onPress={() => beginBand(elo)}>
                  <BotAvatar elo={elo} size={36} />
                  <Text style={{ ...type.sm, fontFamily: font.bold, color: colors.ink, marginTop: space[2] }}>~{elo}</Text>
                  <Text style={{ ...type.xs, fontFamily: font.semibold, color: colors.ink500 }}>4-bot round robin</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </AppShell>
  );
}
