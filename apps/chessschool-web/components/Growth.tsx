"use client";

import { copy, type InviteInfo } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { Button, Card, useToast } from "./ui";

/** Profile: the learner's invite link and how many rewards it has earned. Accounts only, never a child profile. */
export function InviteCard() {
  const { state, track } = useApp();
  const toast = useToast();
  const [info, setInfo] = useState<InviteInfo | null>(null);
  const on = Boolean(state.account) && !state.activeChild;
  useEffect(() => {
    if (on) api.myInvite().then(setInfo, () => {});
  }, [on]);
  if (!on || !info) return null;
  return (
    <Card className="invite-card" aria-labelledby="invite-title">
      <h2 id="invite-title" className="card-title">
        {copy.invite.title}
      </h2>
      <p className="muted">{copy.invite.body}</p>
      <p className="muted">{copy.invite.progress(info.rewards, info.cap)}</p>
      {info.banked ? <p className="muted">{copy.invite.banked(info.banked)}</p> : null}
      <Button
        block
        onClick={() =>
          void shareLink(copy.invite.shareText, info.url).then((r) => {
            if (r !== "none") track("share");
            if (r === "copied") toast(copy.challenge.copied);
          })
        }
      >
        {copy.invite.share}
      </Button>
    </Card>
  );
}

/** Makes a challenge link (a puzzle the learner just tried, or a slow game) and opens its page. */
export function ChallengeButton({ puzzleId, solved, block }: { puzzleId?: string; solved?: boolean; block?: boolean }) {
  const { state, track } = useApp();
  const toast = useToast();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!state.account) return null;
  return (
    <Button
      variant="secondary"
      block={block}
      icon="club"
      loading={busy}
      onClick={() => {
        setBusy(true);
        api
          .createChallenge(puzzleId ? { kind: "puzzle", puzzleId, solved, child: state.activeChild } : { kind: "game", child: state.activeChild })
          .then(async (r) => {
            track("share");
            if ((await shareLink(copy.challenge.shareText, r.challenge.url)) === "copied") toast(copy.challenge.copied);
            router.push(`/c/${r.challenge.code}`);
          })
          .catch((err: { status?: number }) => toast(err?.status === 429 ? copy.challenge.limit : copy.share.failed))
          .finally(() => setBusy(false));
      }}
    >
      {puzzleId ? copy.challenge.puzzle : copy.challenge.game}
    </Button>
  );
}
