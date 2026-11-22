import { isBotId, opponentName, parseSetup } from "@chessschool/chess";
import { ALL_GAMES, botsInLog, copy, filterGames, GAME_KINDS, GAME_RESULTS, gameKind, visibleGames, type GameFilter } from "@chessschool/design";
import { useState } from "react";
import { ScrollView } from "react-native";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { BotAvatar } from "@/components/BotAvatar";
import { Cody } from "@/components/Lottie";
import { Button, Card, Page, T } from "@/components/ui";
import { botName } from "@/components/Daily";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function ReviewList() {
  const { state } = useApp();
  const { c } = useTheme();
  const [filter, setFilter] = useState<GameFilter>(ALL_GAMES);
  const games = filterGames(state.gameLog, filter);
  // Imported games (a removed feature) stay stored but are never listed.
  const log = visibleGames(state.gameLog);
  const bots = botsInLog(log);
  const chip = (key: string, label: string, on: boolean, onPress: () => void) => (
    <Pressable key={key} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={onPress} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14, borderWidth: 1, borderColor: on ? c.brand : c.line, backgroundColor: on ? c.brandSoft : c.card }}>
      <T role="small" style={{ color: on ? c.brandText : c.textMuted }}>
        {label}
      </T>
    </Pressable>
  );
  const row = (label: string, items: React.ReactNode[]) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} accessibilityLabel={label} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 6 }}>
      {items}
    </ScrollView>
  );
  return (
    <Page title={copy.myGames.title} banner={false}>
      <Button title={copy.scan.cta} icon="eye" variant="secondary" onPress={() => router.push("/scan")} />
      {log.length ? (
        <>
          {row(copy.myGames.kindLabel, (["all", ...GAME_KINDS] as const).map((k) => chip(k, copy.myGames.kinds[k], filter.kind === k, () => setFilter({ ...filter, kind: k, bot: null }))))}
          {row(copy.myGames.resultLabel, (["all", ...GAME_RESULTS] as const).map((r) => chip(r, copy.myGames.results[r], filter.result === r, () => setFilter({ ...filter, result: r }))))}
          {filter.kind === "bot" && bots.length > 1 ? row(copy.myGames.botLabel, [chip("any", copy.myGames.anyBot, !filter.bot, () => setFilter({ ...filter, bot: null })), ...bots.map((b) => chip(b, botName(b), filter.bot === b, () => setFilter({ ...filter, bot: b })))]) : null}
        </>
      ) : null}
      {games.length ? (
        games.map((g) => {
          const setup = parseSetup(g.setup);
          if (!setup) return null;
          const bot = setup.opponent.kind === "bot" ? setup.opponent.bot : null;
          const result = g.winner === null ? copy.play.results.draw.title : setup.opponent.kind === "friend" ? copy.gym.friendWin(copy.play.sides[g.winner]) : g.winner === setup.you ? copy.play.results.win.title : copy.play.results.loss.title;
          const scanned = g.reason === "scanned";
          const title = scanned ? copy.scan.savedTitle : gameKind(g) === "challenge" ? copy.myGames.vsChallenge : setup.opponent.kind === "friend" ? copy.gym.vsFriend : setup.opponent.kind === "online" ? copy.gym.vsOnline : copy.play.vs(opponentName(setup));
          const sub = `${scanned ? "" : `${result} · ${copy.gym.moveCount(Math.ceil(g.history.length / 2))} · `}${new Date(g.endedAt).toLocaleDateString()}`;
          return (
            <Pressable
              key={g.id}
              accessibilityRole="button"
              accessibilityLabel={`${title}. ${sub}`}
              onPress={() => router.push(`/review/${encodeURIComponent(g.id)}`)}
              style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: pressed ? c.sunken : c.card })}
            >
              {bot && isBotId(bot) ? (
                <BotAvatar bot={bot} />
              ) : (
                <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: c.brandSoft, alignItems: "center", justifyContent: "center" }}>
                  <T role="label" color="brandText">
                    {setup.opponent.kind === "online" ? "@" : "2P"}
                  </T>
                </View>
              )}
              <View style={{ flex: 1, gap: 2 }}>
                <T role="label">{title}</T>
                <T role="small" color="textMuted">
                  {sub}
                </T>
              </View>
            </Pressable>
          );
        })
      ) : (
        <Card style={{ alignItems: "center", gap: 12 }}>
          <Cody animation="reading" size={140} label={copy.a11y.mascot} />
          <T role="bodyLg" color="textMuted" center>
            {log.length ? copy.myGames.none : copy.gym.reviewEmpty}
          </T>
        </Card>
      )}
    </Page>
  );
}
