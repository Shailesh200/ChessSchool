import { isBotId, opponentName, parseSetup } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { BotAvatar } from "@/components/BotAvatar";
import { Cody } from "@/components/Lottie";
import { Card, Page, T } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function ReviewList() {
  const { state } = useApp();
  const { c } = useTheme();
  return (
    <Page title={copy.gym.review.name} banner={false}>
      {state.gameLog.length ? (
        state.gameLog.map((g) => {
          const setup = parseSetup(g.setup);
          if (!setup) return null;
          const bot = setup.opponent.kind === "bot" ? setup.opponent.bot : null;
          const result = g.winner === null ? copy.play.results.draw.title : setup.opponent.kind === "friend" ? copy.gym.friendWin(copy.play.sides[g.winner]) : g.winner === setup.you ? copy.play.results.win.title : copy.play.results.loss.title;
          const title = setup.opponent.kind === "friend" ? copy.gym.vsFriend : copy.play.vs(opponentName(setup));
          const sub = `${result} · ${copy.gym.moveCount(Math.ceil(g.history.length / 2))} · ${new Date(g.endedAt).toLocaleDateString()}`;
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
                    2P
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
            {copy.gym.reviewEmpty}
          </T>
        </Card>
      )}
    </Page>
  );
}
