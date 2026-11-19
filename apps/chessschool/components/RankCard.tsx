import { copy, rankFor, RANKS, type RankId } from "@chessschool/design";
import type { PieceType } from "@chessschool/chess";
import { router } from "expo-router";
import { Pressable, View } from "react-native";
import { fonts, useTheme } from "@/lib/theme";
import { PieceArt } from "./Board";
import { Icon } from "./Icon";
import { Card, T } from "./ui";

const PIECE: Record<RankId, PieceType> = { pawn: "p", knight: "n", bishop: "b", rook: "r", queen: "q", king: "k" };

/** Learn: "Your rank". A gold medal with the current rank's piece, progress to the next rank, the six-rank ladder and three stats. */
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
    <Card style={{ gap: 18 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <T role="eyebrow" color="textMuted" header>
          {copy.today.rankTitle}
        </T>
        <T role="small" color="textMuted">
          {copy.today.rankStep(r.index + 1, RANKS.length)}
        </T>
      </View>

      <View style={{ flexDirection: "row", alignItems: "center", gap: 16 }}>
        <View style={{ width: 92, height: 92, borderRadius: 46, backgroundColor: c.gold, borderBottomWidth: 6, borderColor: c.goldEdge, alignItems: "center", justifyContent: "center", shadowColor: c.goldEdge, shadowOpacity: 0.35, shadowRadius: 9, shadowOffset: { width: 0, height: 8 }, elevation: 4 }}>
          <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: c.goldSoft, alignItems: "center", justifyContent: "center" }}>
            <PieceArt piece={{ type: PIECE[r.rank], color: "b" }} size={52} />
          </View>
        </View>
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
                <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: done ? c.successSoft : now ? c.goldSoft : c.sunken, borderWidth: now ? 2 : 0, borderColor: c.gold, opacity: done || now ? 1 : 0.6 }}>
                  <PieceArt piece={{ type: PIECE[rank.id], color: "b" }} size={26} />
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
