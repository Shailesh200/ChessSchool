import { CARD_BACKDROPS, copy, rankFor, RANKS } from "@chessschool/design";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { RankEmblem } from "./RankEmblem";
import { Card, T } from "./ui";

/** Learn: "Your rank". The current rank's emblem, progress to the next rank, the six-rank ladder and three stats. */
export function RankCard({ xp, streak, rating, puzzleRating }: { xp: number; streak: number; rating: number; puzzleRating: number }) {
  const { c } = useTheme();
  const r = rankFor(xp);
  const goal = r.next ? RANKS[r.index + 1].xp : xp;
  const stats: [string, string][] = [
    [String(streak), copy.today.statStreak],
    [String(rating), copy.today.statRating],
    [String(puzzleRating), copy.today.statPuzzles],
  ];
  return (
    <Card art={CARD_BACKDROPS.rank} style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T role="eyebrow" color="textMuted" header>
          {copy.today.rankTitle}
        </T>
        <T role="small" color="textMuted">
          {copy.today.rankStep(r.index + 1, RANKS.length)}
        </T>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <RankEmblem rank={r.rank} size={104} />
        <View style={{ flex: 1, gap: 6 }}>
          <T role="title" style={{ fontSize: 30, lineHeight: 32 }}>
            {copy.ranks[r.rank]}
          </T>
          <T role="small" color="textMuted">
            {copy.today.rankXp(xp)}
          </T>
          <View style={{ alignSelf: "flex-start", backgroundColor: c.brandSoft, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
            <T role="micro" style={{ color: c.brandText, fontFamily: fonts.bold }}>
              {r.next ? copy.today.rankToNext(r.toNext, copy.ranks[r.next]) : copy.today.rankTop}
            </T>
          </View>
        </View>
      </View>

      <View style={{ gap: 8 }}>
        <View accessible accessibilityRole="progressbar" accessibilityLabel={copy.today.rankBar(xp, goal)} style={{ height: 12, borderRadius: 999, backgroundColor: c.sunken, overflow: "hidden" }}>
          <View style={{ width: `${Math.round(r.fraction * 100)}%`, height: 12, borderRadius: 999, backgroundColor: c.brand }} />
        </View>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          {RANKS.map((rank, i) => {
            const done = i < r.index;
            const now = i === r.index;
            return (
              <View key={rank.id} style={{ alignItems: "center", gap: 4, flex: 1 }}>
                <View style={{ width: 40, height: 40, alignItems: "center", justifyContent: "center", opacity: done || now ? 1 : 0.4 }}>
                  <RankEmblem rank={rank.id} size={now ? 40 : 34} />
                </View>
                <T role="micro" color={now ? "text" : "textMuted"} style={now ? { fontFamily: fonts.bold } : undefined}>
                  {copy.ranks[rank.id]}
                </T>
              </View>
            );
          })}
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8 }}>
        {stats.map(([value, label]) => (
          <View key={label} style={{ flex: 1, backgroundColor: c.bg, borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12, gap: 2 }}>
            <T role="heading" style={{ fontFamily: fonts.bold }}>
              {value}
            </T>
            <T role="micro" color="textMuted">
              {label}
            </T>
          </View>
        ))}
      </View>
      <Pressable accessibilityRole="button" onPress={() => router.push("/leaderboard")} style={{ flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44 }}>
        <Icon name="trophy" size={20} color={c.goldText} />
        <T role="label" style={{ flex: 1 }}>
          {copy.board.open}
        </T>
        <Icon name="chevron" size={20} color={c.brandText} />
      </Pressable>
    </Card>
  );
}
