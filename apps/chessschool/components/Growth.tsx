import { copy, type InviteInfo, type ShareCardData, type ShareCardKind } from "@chessschool/design";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareCard, shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { Button, Card, T, useToast } from "./ui";

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
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  if (!state.account) return null;
  return (
    <Button
      title={puzzleId ? copy.challenge.puzzle : copy.challenge.game}
      icon="club"
      variant="secondary"
      loading={busy}
      onPress={() => {
        setBusy(true);
        api
          .createChallenge(puzzleId ? { kind: "puzzle", puzzleId, solved, child: state.activeChild } : { kind: "game", child: state.activeChild })
          .then(async (r) => {
            if (await shareLink(copy.challenge.shareText, r.challenge.url)) track("share");
            router.push(`/c/${r.challenge.code}` as never);
          })
          .catch((err: { status?: number }) => toast(err?.status === 429 ? copy.challenge.limit : copy.share.failed))
          .finally(() => setBusy(false));
      }}
    />
  );
}
