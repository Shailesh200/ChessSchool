"use client";

import { copy, isLive, TIME_CONTROLS, type InviteInfo, type TimeControl } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { shareLink } from "@/lib/share";
import { useApp } from "@/lib/state";
import { Icon } from "./Icon";
import { Button, Card, Sheet, useToast } from "./ui";

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
  const [picking, setPicking] = useState(false);
  const [tc, setTc] = useState<TimeControl>("10m");
  if (!state.account) return null;
  const t = copy.challenge;
  const send = (input: Parameters<typeof api.createChallenge>[0]) => {
    setBusy(true);
    api
      .createChallenge(input)
      .then(async (r) => {
        track("share");
        setPicking(false);
        if ((await shareLink(t.shareText, r.challenge.url)) === "copied") toast(t.copied);
        router.push(`/c/${r.challenge.code}`);
      })
      .catch((err: { status?: number }) => toast(err?.status === 429 ? t.limit : copy.share.failed))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Button variant="secondary" block={block} icon="club" loading={busy && !picking} onClick={() => (puzzleId ? send({ kind: "puzzle", puzzleId, solved, child: state.activeChild }) : setPicking(true))}>
        {puzzleId ? t.puzzle : t.game}
      </Button>
      <Sheet open={picking} onClose={() => setPicking(false)} labelledBy="tc-title">
        <div className="tc-sheet">
          <h2 id="tc-title">{t.puzzle}</h2>
          <p className="muted">{t.setupBody}</p>
          <span className="eyebrow">{t.timePer}</span>
          <div className="tc-grid" role="radiogroup" aria-labelledby="tc-title">
            {TIME_CONTROLS.map((id) => (
              <button key={id} type="button" role="radio" aria-checked={tc === id} className={`${tc === id ? "is-on" : ""}${id === "none" ? " is-wide" : ""}`} onClick={() => setTc(id)}>
                <strong>{t.tc[id]}</strong>
                <span>{t.tcSub[id]}</span>
              </button>
            ))}
          </div>
          <p className="tc-rules">
            <Icon name="clock" size={20} />
            <span>{isLive(tc) ? t.rules.live : tc === "1d" ? t.rules.day : t.rules.none}</span>
          </p>
          <Button block icon="arrowRight" loading={busy} onClick={() => send({ kind: "game", tc, child: state.activeChild })}>
            {t.send}
          </Button>
        </div>
      </Sheet>
    </>
  );
}
