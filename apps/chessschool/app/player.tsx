import { copy, countryName, isUnitBadge, rankFor, SOCIALS, socialUrl, type BadgeId, type IconName, type PlayerGame, type PlayerProfile } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { botName } from "@/components/Daily";
import { Icon } from "@/components/Icon";
import { Button, Card, Page, Row, Sheet, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { RankEmblem } from "@/components/RankEmblem";

/** A player's public profile (leaderboard row, friend, link): rank, stats, trophies, recent games, details, links, and add friend / report / block. */
export default function PlayerScreen() {
  const { id = "" } = useLocalSearchParams<{ id?: string }>();
  const { state, cue } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const t = copy.social;
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);

  const load = useCallback(() => {
    setMissing(false);
    api.player(id).then((r) => setPlayer(r.player), () => setMissing(true));
  }, [id]);
  useEffect(() => {
    if (state.account && id) load();
  }, [load, state.account, id]);

  if (!state.account || missing) {
    return (
      <Page title={t.profileTitle} banner={false}>
        <T role="body" color="textMuted">
          {state.account ? t.notFound : copy.board.signIn}
        </T>
      </Page>
    );
  }
  if (!player) {
    return (
      <Page title={t.profileTitle} banner={false}>
        <T role="small" color="textMuted">
          {t.loading}
        </T>
        <ActivityIndicator color={c.brand} />
      </Page>
    );
  }

  const d = player.details;
  const banner = d.banner ? c[d.banner] : c.brand;
  const facts: { label: string; value: string }[] = [
    { label: t.favPiece, value: d.favPiece ? copy.profileEdit.pieces[d.favPiece] : "" },
    { label: t.favOpening, value: d.favOpening },
    { label: t.goal, value: d.goal },
    { label: t.playingSince, value: d.playingSince ? String(d.playingSince) : "" },
    { label: t.city, value: d.city },
  ].filter((f) => f.value);
  const links = SOCIALS.filter((n) => d.socials[n]);

  const friend = async () => {
    setBusy(true);
    try {
      if (player.friend) {
        await api.removeFriend(player.id);
        toast(t.removed(player.name));
      } else {
        await api.addFriend(player.id);
        cue("success");
        toast(t.added(player.name));
      }
      setPlayer({ ...player, friend: !player.friend });
    } catch {
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };
  const block = async () => {
    setBusy(true);
    try {
      await api.blockPlayer(player.id);
      toast(t.blocked(player.name));
      setConfirmBlock(false);
      router.back();
    } catch {
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  const rank = rankFor(player.xp);
  const trophies = (player.badges ?? []).filter((id) => !isUnitBadge(id as BadgeId) && id in copy.badges.list) as BadgeId[];
  const stats: { label: string; value: string; icon: IconName; tint: string }[] = [
    { label: t.streak, value: String(player.streak ?? 0), icon: "spark", tint: c.accent },
    { label: t.xp, value: String(player.xp), icon: "bolt", tint: c.gold },
    { label: t.lessons, value: String(player.lessons ?? 0), icon: "learn", tint: c.successText },
    { label: t.playRating, value: player.rating ? String(player.rating) : t.unrated, icon: "gym", tint: c.brandText },
    { label: t.puzzleRating, value: player.puzzleRating ? String(player.puzzleRating) : t.unrated, icon: "puzzle", tint: c.brandText },
    { label: t.bestWin, value: player.bestWin ? String(player.bestWin) : "–", icon: "trophy", tint: c.goldText },
  ];
  const since = new Date(player.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const opponent = (g: PlayerGame) => (g.opponent.kind === "bot" ? t.vsBot(botName(g.opponent.bot)) : g.opponent.kind === "online" ? t.vsOnline : t.vsFriend);
  const resultTint = (g: PlayerGame) => (g.result === "win" ? c.successText : g.result === "loss" ? c.dangerText : c.textMuted);

  return (
    <Page title={player.name} banner={false}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ height: 96, backgroundColor: banner }}>
          <View style={{ position: "absolute", right: 16, top: 14, paddingHorizontal: 12, minHeight: 28, borderRadius: 14, justifyContent: "center", backgroundColor: "rgba(0,0,0,0.22)" }}>
            <T role="micro" style={{ color: "#fff", fontFamily: fonts.semibold }}>
              {`${copy.ranks[rank.rank]} · ${player.xp} ${t.xp}`}
            </T>
          </View>
        </View>
        <View style={{ paddingHorizontal: 16, paddingBottom: 18, marginTop: -48, gap: 6 }}>
          <View style={{ alignSelf: "flex-start", borderRadius: 52, borderWidth: 4, borderColor: c.card, backgroundColor: c.card }}>
            <AvatarFace id={player.avatar} photo={player.photo} size={92} country={player.country} />
          </View>
          <T role="title" numberOfLines={1}>
            {player.name}
          </T>
          {player.username ? (
            <T role="label" color="brandText">
              {t.at(player.username)}
            </T>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingLeft: 6, paddingRight: 10, minHeight: 26, borderRadius: 13, backgroundColor: c.brandSoft }}>
              <RankEmblem rank={rank.rank} size={22} />
              <T role="micro" style={{ color: c.brandText, fontFamily: fonts.semibold }}>
                {copy.today.level(copy.ranks[rank.rank], rank.level)}
              </T>
            </View>
            {player.country ? (
              <View style={{ paddingHorizontal: 10, minHeight: 26, borderRadius: 13, justifyContent: "center", backgroundColor: c.sunken }}>
                <T role="micro" color="textMuted">
                  {countryName(player.country)}
                </T>
              </View>
            ) : null}
            {player.friend ? (
              <View style={{ paddingHorizontal: 10, minHeight: 26, borderRadius: 13, justifyContent: "center", backgroundColor: c.successSoft }}>
                <T role="micro" style={{ color: c.successText, fontFamily: fonts.semibold }}>
                  {t.friend}
                </T>
              </View>
            ) : null}
          </View>
          {d.bio ? <T role="body">{d.bio}</T> : null}
          <T role="micro" color="textMuted">
            {t.memberSince(since)}
          </T>
        </View>
      </Card>

      <Card style={{ paddingVertical: 6, paddingHorizontal: 4 }}>
        <View accessibilityRole="list" style={{ flexDirection: "row", flexWrap: "wrap" }}>
          {stats.map((st, i) => (
            <View key={st.label} accessible accessibilityLabel={`${st.label}: ${st.value}`} style={{ width: "33.33%", alignItems: "center", gap: 2, paddingVertical: 12, borderTopWidth: i >= 3 ? 1 : 0, borderLeftWidth: i % 3 ? 1 : 0, borderColor: c.line }}>
              <Icon name={st.icon} size={18} color={st.tint} />
              <T role="heading" style={{ fontFamily: fonts.bold }}>
                {st.value}
              </T>
              <T role="micro" color="textMuted" center>
                {st.label}
              </T>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ gap: 10 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <T role="eyebrow" color="textMuted" header>
            {t.recent}
          </T>
          {player.games ? (
            <T role="micro" color="textMuted">
              {t.games(player.games.played, player.games.won)}
            </T>
          ) : null}
        </View>
        {player.recent?.length ? (
          player.recent.map((g) => (
            <View key={g.id} accessible accessibilityLabel={`${t.results[g.result]}, ${opponent(g)}, ${t.moves(g.moves)}`} style={{ flexDirection: "row", alignItems: "center", gap: 12, minHeight: 44 }}>
              <View style={{ width: 36, height: 36, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: g.result === "win" ? c.successSoft : g.result === "loss" ? c.dangerSoft : c.sunken }}>
                <Icon name={g.result === "win" ? "trophy" : g.result === "loss" ? "close" : "gym"} size={18} color={resultTint(g)} />
              </View>
              <View style={{ flex: 1 }}>
                <T role="label" numberOfLines={1}>
                  {opponent(g)}
                </T>
                <T role="micro" color="textMuted">
                  {`${t.moves(g.moves)} · ${new Date(g.endedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
                </T>
              </View>
              <T role="label" style={{ color: resultTint(g), fontFamily: fonts.bold }}>
                {t.results[g.result]}
              </T>
            </View>
          ))
        ) : (
          <T role="small" color="textMuted">
            {t.noGames}
          </T>
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <T role="eyebrow" color="textMuted" header>
          {`${t.trophies} · ${trophies.length}`}
        </T>
        {trophies.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {trophies.slice(-8).reverse().map((id) => (
              <View key={id} style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 10, minHeight: 32, borderRadius: 16, backgroundColor: c.goldSoft, borderWidth: 1, borderColor: c.gold }}>
                <Icon name="trophy" size={14} color={c.goldText} />
                <T role="micro" style={{ color: c.goldText, fontFamily: fonts.semibold }}>
                  {copy.badges.list[id].name}
                </T>
              </View>
            ))}
          </View>
        ) : (
          <T role="small" color="textMuted">
            {t.noTrophies}
          </T>
        )}
      </Card>

      {facts.length ? (
        <Card style={{ gap: 10 }}>
          {facts.map((f) => (
            <View key={f.label} style={{ gap: 2 }}>
              <T role="micro" color="textMuted">
                {f.label}
              </T>
              <T role="label">{f.value}</T>
            </View>
          ))}
        </Card>
      ) : null}

      {links.length ? (
        <Card style={{ padding: 6 }}>
          <T role="eyebrow" color="textMuted" header style={{ paddingHorizontal: 12, paddingTop: 10 }}>
            {t.links}
          </T>
          {links.map((n) => {
            const url = socialUrl(n, d.socials[n]!);
            return <Row key={n} icon="arrowRight" label={copy.profileEdit.networks[n]} hint={`@${d.socials[n]}`} chevron onPress={() => void WebBrowser.openBrowserAsync(url).catch(() => Linking.openURL(url))} />;
          })}
        </Card>
      ) : null}

      {player.me ? (
        <Button title={copy.profileEdit.open} icon="edit" variant="secondary" onPress={() => router.push("/profile-edit")} />
      ) : (
        <View style={{ gap: 10 }}>
          <Button title={player.friend ? t.removeFriend : t.addFriend} icon="profile" variant={player.friend ? "secondary" : "primary"} loading={busy && !confirmBlock} onPress={friend} />
          <Button title={t.report} icon="flag" variant="secondary" onPress={() => router.push({ pathname: "/report", params: { playerId: player.id, name: player.name } })} />
          <Button title={t.block} icon="block" variant="ghost" onPress={() => setConfirmBlock(true)} />
        </View>
      )}

      <Sheet visible={confirmBlock} onClose={() => setConfirmBlock(false)}>
        <T role="heading" header center>
          {t.blockTitle(player.name)}
        </T>
        <T role="body" color="textMuted" center>
          {t.blockBody}
        </T>
        <Button title={t.blockConfirm} icon="block" variant="danger" loading={busy} onPress={block} />
        <Button title={t.cancel} variant="ghost" onPress={() => setConfirmBlock(false)} />
      </Sheet>
    </Page>
  );
}
