import { copy, flagOf, type BoardMetric, type BoardResponse, type BoardRow, type BoardScope } from "@chessschool/design";
import { isOfflineError } from "@chessschool/design";
import { router } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Icon } from "@/components/Icon";
import { Button, Page, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

/** Global, country and friends boards, ranked by XP this week, rating or the strongest bot beaten. */
export default function Leaderboard() {
  const { state } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.board;
  const country = state.profile.country ?? null;
  const [scope, setScope] = useState<BoardScope>("global");
  const [metric, setMetric] = useState<BoardMetric>("xp");
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [failed, setFailed] = useState<false | "offline" | "error">(false);
  const load = useCallback(() => {
    setBoard(null);
    setFailed(false);
    api
      .board(scope, metric)
      .then(setBoard)
      .catch((err) => setFailed(isOfflineError(err) ? "offline" : "error"));
  }, [scope, metric]);
  useEffect(() => {
    if (state.account) load();
  }, [load, state.account, country]);

  const addFriend = (r: BoardRow) => {
    api
      .addFriend(r.id)
      .then(() => {
        toast(t.added(r.name));
        setBoard((b) => (b ? { ...b, rows: b.rows.map((x) => (x.id === r.id ? { ...x, friend: true } : x)) } : b));
      })
      .catch(() => toast(copy.auth.errors.generic));
  };

  const scopes: [BoardScope, string][] = [
    ["global", t.global],
    ["country", country ? `${flagOf(country)} ${t.country}` : t.country],
    ["friends", t.friends],
  ];
  const metrics: [BoardMetric, string][] = [
    ["xp", t.xp],
    ["rating", t.rating],
    ["wins", t.wins],
  ];
  const medal = [c.gold, c.line, c.accent];

  if (!state.account) {
    return (
      <Page title={t.title} banner={false}>
        <T role="bodyLg">{t.signIn}</T>
      </Page>
    );
  }
  return (
    <Page title={t.title} banner={false}>
      <View accessibilityRole="tablist" style={{ flexDirection: "row", gap: 4, padding: 4, borderRadius: 999, backgroundColor: c.sunken }}>
        {scopes.map(([id, label]) => (
          <Pressable key={id} accessibilityRole="tab" accessibilityState={{ selected: scope === id }} onPress={() => setScope(id)} style={{ flex: 1, minHeight: 40, borderRadius: 999, alignItems: "center", justifyContent: "center", backgroundColor: scope === id ? c.card : "transparent" }}>
            <T role="small" numberOfLines={1} style={{ fontFamily: fonts.semibold, color: scope === id ? c.brandText : c.textMuted }}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 8, flexWrap: "wrap" }}>
        {metrics.map(([id, label]) => (
          <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: metric === id }} onPress={() => setMetric(id)} style={{ minHeight: 36, paddingHorizontal: 12, borderRadius: 999, justifyContent: "center", backgroundColor: metric === id ? c.text : c.card, borderWidth: metric === id ? 0 : 1, borderColor: c.line }}>
            <T role="small" style={{ fontFamily: fonts.bold, color: metric === id ? c.bg : c.text }}>
              {label}
            </T>
          </Pressable>
        ))}
      </View>

      {failed ? (
        <View style={{ gap: 10 }}>
          <T role="small" color="dangerText">
            {failed === "offline" ? copy.offlineMode.needsConnection : copy.auth.errors.generic}
          </T>
          <Button title={copy.puzzles.retry} variant="secondary" onPress={load} />
        </View>
      ) : !board ? (
        <ActivityIndicator color={c.brand} style={{ marginTop: 24 }} />
      ) : board.needsCountry ? (
        <View style={{ gap: 10 }}>
          <T role="body" color="textMuted">
            {t.needsCountry}
          </T>
          <Button title={t.pickCountry} icon="flag" onPress={() => router.push("/country")} />
        </View>
      ) : board.rows.length === 0 ? (
        <T role="body" color="textMuted">
          {scope === "friends" ? t.friendsEmpty : t.empty}
        </T>
      ) : (
        <View accessibilityRole="list" style={{ gap: 8 }}>
          {board.rows.map((r) => (
            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 18, backgroundColor: r.me ? c.brandSoft : r.rank <= 3 ? c.card : "transparent" }}>
              <View style={{ width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: r.rank <= 3 ? medal[r.rank - 1] : "transparent" }}>
                <T role="small" style={{ fontFamily: fonts.bold, color: r.rank <= 3 ? c.text : c.textMuted }}>
                  {String(r.rank)}
                </T>
              </View>
              <AvatarFace id={r.avatar} size={40} />
              <View style={{ flex: 1, gap: 2 }}>
                <T role="label" numberOfLines={1}>
                  {`${r.me ? t.you : r.name}${r.country ? ` ${flagOf(r.country)}` : ""}`}
                </T>
                {r.friend ? (
                  <T role="micro" color="textMuted">
                    {t.friend}
                  </T>
                ) : null}
              </View>
              <T role="label" style={{ fontFamily: fonts.bold }}>
                {t.value(metric, r.value)}
              </T>
              {!r.me && !r.friend ? (
                <Pressable accessibilityRole="button" accessibilityLabel={t.add(r.name)} onPress={() => addFriend(r)} hitSlop={6} style={{ width: 36, height: 36, borderRadius: 18, borderWidth: 1.5, borderColor: c.brand, alignItems: "center", justifyContent: "center" }}>
                  <Icon name="profile" size={16} color={c.brand} />
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      )}

      {board && !board.needsCountry && !board.rows.some((r) => r.me) ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 20, backgroundColor: c.text }}>
          <T role="heading" style={{ color: c.bg, width: 44, textAlign: "center" }}>
            {board.me.rank ? `#${board.me.rank}` : "–"}
          </T>
          <T role="small" style={{ flex: 1, color: c.bg }}>
            {board.me.rank ? t.you : t.unranked}
          </T>
          {board.me.value ? (
            <T role="label" style={{ color: c.bg, fontFamily: fonts.bold }}>
              {t.value(metric, board.me.value)}
            </T>
          ) : null}
        </View>
      ) : null}
    </Page>
  );
}
