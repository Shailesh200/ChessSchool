import { copy, isLive, TIME_CONTROLS, type InviteInfo, type ShareCardData, type ShareCardKind, type TimeControl } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, View } from "react-native";
import { api } from "@/lib/api";
import { shareCard, shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Icon } from "./Icon";
import { Button, Card, Sheet, T, useToast } from "./ui";

/** "Share": makes the card for the active learner and opens the share sheet. */
export function ShareCardButton({ kind, data, label, variant = "secondary" }: { kind: ShareCardKind; data: ShareCardData; label?: string; variant?: "primary" | "secondary" | "ghost" }) {
  const { state, track } = useApp();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  return (
    <Button
      title={label ?? copy.share.button}
      variant={variant}
      loading={busy}
      onPress={async () => {
        setBusy(true);
        try {
          if (await shareCard(kind, data, { child: state.activeChild, avatar: state.profile.avatar })) track("share");
        } catch {
          toast(copy.share.failed);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
}

/** Profile: the learner's invite link and how many rewards it has earned. Accounts only, never a child profile. */
export function InviteCard() {
  const { state, track } = useApp();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const on = Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  if (!on || !info) return null;
  return (
    <Card style={{ gap: 8 }}>
      <T role="heading" header>
        {copy.invite.title}
      </T>
      <T role="body" color="textMuted">
        {copy.invite.body}
      </T>
      <T role="small" color="textMuted">
        {copy.invite.progress(info.rewards, info.cap)}
      </T>
      {info.banked ? (
        <T role="small" color="textMuted">
          {copy.invite.banked(info.banked)}
        </T>
      ) : null}
      <Button title={copy.invite.share} onPress={async () => (await shareLink(copy.invite.shareText, info.url)) && track("share")} />
    </Card>
  );
}

/** Makes a challenge link (a puzzle the learner just tried, or a slow game), shares it and opens its screen. */
export function ChallengeButton({ puzzleId, solved }: { puzzleId?: string; solved?: boolean }) {
  const { state, track } = useApp();
  const { c } = useTheme();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [picking, setPicking] = useState(false);
  const [tc, setTc] = useState<TimeControl>("10m");
  if (!state.account) return null;
  const t = copy.challenge;
  const send = (input: Parameters<typeof api.createChallenge>[0]) => {
    setBusy(true);
    api
      .createChallenge(input)
      .then(async (r) => {
        setPicking(false);
        if (await shareLink(t.shareText, r.challenge.url)) track("share");
        router.push(`/c/${r.challenge.code}` as never);
      })
      .catch((err: { status?: number }) => toast(err?.status === 429 ? t.limit : copy.share.failed))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Button
        title={puzzleId ? t.puzzle : t.game}
        icon="club"
        variant="secondary"
        loading={busy && !picking}
        onPress={() => (puzzleId ? send({ kind: "puzzle", puzzleId, solved, child: state.activeChild }) : setPicking(true))}
      />
      <Sheet visible={picking} onClose={() => setPicking(false)} scroll>
        <View style={{ gap: 14, alignSelf: "stretch" }}>
          <View style={{ gap: 4 }}>
            <T role="title" header>
              {t.puzzle}
            </T>
            <T role="small" color="textMuted">
              {t.setupBody}
            </T>
          </View>
          <T role="eyebrow" color="textMuted">
            {t.timePer}
          </T>
          <View accessibilityRole="radiogroup" style={{ flexDirection: "row", flexWrap: "wrap", gap: 10 }}>
            {TIME_CONTROLS.map((id) => {
              const on = tc === id;
              return (
                <Pressable key={id} accessibilityRole="radio" accessibilityState={{ checked: on }} onPress={() => setTc(id)} style={{ flexBasis: id === "none" ? "100%" : "47%", flexGrow: 1, minHeight: 72, borderRadius: 18, paddingHorizontal: 16, justifyContent: "center", gap: 2, backgroundColor: on ? c.text : c.card, borderWidth: on ? 0 : 1, borderColor: c.line }}>
                  <T role="heading" style={{ color: on ? c.bg : c.text, fontFamily: fonts.bold }}>
                    {t.tc[id]}
                  </T>
                  <T role="micro" style={{ color: on ? c.bg : c.textMuted }}>
                    {t.tcSub[id]}
                  </T>
                </Pressable>
              );
            })}
          </View>
          <View style={{ flexDirection: "row", gap: 12, padding: 14, borderRadius: 18, borderWidth: 1, borderColor: c.line, backgroundColor: c.card }}>
            <Icon name="clock" size={20} color={c.brandText} />
            <T role="small" style={{ flex: 1 }}>
              {isLive(tc) ? t.rules.live : tc === "1d" ? t.rules.day : t.rules.none}
            </T>
          </View>
          <Button title={t.send} icon="arrowRight" loading={busy} onPress={() => send({ kind: "game", tc, child: state.activeChild })} />
        </View>
      </Sheet>
    </>
  );
}
