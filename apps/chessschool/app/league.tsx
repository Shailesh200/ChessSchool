import { closesIn, copy, isAvatarId, PROMOTE, pushCelebration, RELEGATE, type LeagueResponse } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Button, Card, Chip, Page, T } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** This week's league: up to 30 learners in a tier, ranked by XP (Monday to Sunday, India time). */
export default function LeagueScreen() {
  const { state, update } = useApp();
  const { c } = useTheme();
  const t = copy.leagues;
  const [res, setRes] = useState<LeagueResponse | "offline" | null>(null);
  const signedIn = Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .league()
      .then((r) => {
        if (!live) return;
        setRes(r);
        // A promotion last week: celebrated once (the id carries the week).
        if (r.status === "joined" && r.league.promoted) {
          const league = r.league.promoted;
          update((s) => pushCelebration(s, { id: `main:league:${r.league.week}`, kind: "league", league }));
        }
      })
      .catch(() => live && setRes("offline"));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `update` changes with every state change
  }, [signedIn]);

  let body: React.ReactNode;
  if (state.activeChild) body = <T role="body" color="textMuted">{t.child}</T>;
  else if (!state.account || (res !== "offline" && res?.status === "guest"))
    body = (
      <Card style={{ gap: 10 }}>
        <T role="heading" header>
          {t.guestTitle}
        </T>
        <T role="body" color="textMuted">
          {t.guestBody}
        </T>
        <Button title={t.signup} icon="shield" onPress={() => router.push("/signup")} />
      </Card>
    );
  else if (res === "offline") body = <T role="body" color="textMuted">{t.offline}</T>;
  else if (!res) body = <ActivityIndicator style={{ marginTop: 24 }} />;
  else if (res.status === "none")
    body = (
      <Card style={{ gap: 10 }}>
        <T role="body" color="textMuted">
          {t.notJoined}
        </T>
        <Button title={copy.lesson.back} icon="learn" onPress={() => router.replace("/today")} />
      </Card>
    );
  else if (res.status === "joined") {
    const { league } = res;
    const left = closesIn(league.week, Date.now());
    body = (
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <T role="heading" header>
            {t.tiers[league.tier]}
          </T>
          <Chip icon="clock" tone="gold">
            {t.closes(left.days, left.hours, left.minutes)}
          </Chip>
        </View>
        <T role="small" color="textMuted">
          {league.tier !== "pawn" ? `${t.upHint(PROMOTE)} ${t.downHint(RELEGATE)}` : t.upHint(PROMOTE)}
        </T>
        <View style={{ gap: 4 }}>
          {league.members.map((m) => (
            <View
              key={m.place}
              accessible
              accessibilityLabel={t.rowA11y(m.place, m.you ? t.you : m.name, m.xp)}
              style={{
                flexDirection: "row",
                alignItems: "center",
                gap: 10,
                minHeight: 48,
                paddingHorizontal: 10,
                borderRadius: 12,
                backgroundColor: m.you ? c.brandSoft : c.card,
                borderLeftWidth: 4,
                borderLeftColor: m.zone === "up" ? c.success : m.zone === "down" ? c.danger : "transparent",
              }}
            >
              <T role="label" color="textMuted" style={{ width: 32 }}>
                {t.place(m.place)}
              </T>
              <AvatarFace id={isAvatarId(m.avatar) ? m.avatar : "cody"} size={28} />
              <T role="body" numberOfLines={1} style={{ flex: 1 }}>
                {m.you ? `${m.name} (${t.you})` : m.name}
              </T>
              {m.zone !== "stay" ? (
                <T role="small" color="textMuted">
                  {m.zone === "up" ? t.up : t.down}
                </T>
              ) : null}
              <T role="label" color="brandText">
                {t.xp(m.xp)}
              </T>
            </View>
          ))}
        </View>
      </View>
    );
  }
  return <Page title={t.title}>{body}</Page>;
}
