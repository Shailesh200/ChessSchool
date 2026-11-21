import { copy, countryName, flagOf, SOCIALS, socialUrl, type PlayerProfile } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Linking, View } from "react-native";
import { AvatarFace } from "@/components/AvatarFace";
import { Button, Card, Page, Row, Sheet, T, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

/** A player's public profile (leaderboard row, friend, class member): details, links, and add friend / report / block. */
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

  return (
    <Page title={player.name} banner={false}>
      <Card style={{ padding: 0, overflow: "hidden" }}>
        <View style={{ height: 72, backgroundColor: banner }} />
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, marginTop: -40, gap: 8 }}>
          <View style={{ alignSelf: "flex-start", borderRadius: 48, borderWidth: 4, borderColor: c.card }}>
            <AvatarFace id={player.avatar} photo={player.photo} size={84} />
          </View>
          <T role="title" numberOfLines={1}>
            {`${player.name}${player.country ? ` ${flagOf(player.country)}` : ""}`}
          </T>
          {player.country ? (
            <T role="small" color="textMuted">
              {countryName(player.country)}
            </T>
          ) : null}
          {d.bio ? <T role="body">{d.bio}</T> : null}
          <T role="micro" color="textMuted">
            {t.joined(new Date(player.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }))}
          </T>
        </View>
      </Card>

      <Card style={{ flexDirection: "row", paddingVertical: 12 }}>
        {[
          { label: t.rating, value: player.rating ? String(player.rating) : "–" },
          { label: t.xp, value: String(player.xp) },
        ].map((s, i) => (
          <View key={s.label} accessible accessibilityLabel={`${s.label}: ${s.value}`} style={{ flex: 1, alignItems: "center", gap: 2, borderLeftWidth: i ? 1 : 0, borderColor: c.line }}>
            <T role="heading" style={{ fontFamily: fonts.bold }}>
              {s.value}
            </T>
            <T role="micro" color="textMuted">
              {s.label}
            </T>
          </View>
        ))}
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
