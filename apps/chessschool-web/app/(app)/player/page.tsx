"use client";

import { copy, countryName, flagOf, SOCIALS, socialUrl, type PlayerProfile } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MemberFace } from "@/components/ClassPlay";
import { bannerVar } from "@/components/Social";
import { Cody } from "@/components/Lottie";
import { Button, Card, Sheet, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** A player's public profile (leaderboard row, friend): details, links, and add friend / report / block. */
function Player() {
  const id = useSearchParams().get("id") ?? "";
  const router = useRouter();
  const { state, ready, cue } = useApp();
  const toast = useToast();
  const t = copy.social;
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [missing, setMissing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmBlock, setConfirmBlock] = useState(false);
  useEffect(() => {
    if (ready && state.account && id) api.player(id).then((r) => setPlayer(r.player), () => setMissing(true));
  }, [ready, state.account, id]);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  if (!state.account || missing || !id) {
    return (
      <div className="page page-narrow">
        <TopBar title={t.profileTitle} backHref="/leaderboard" />
        <p className="muted">{state.account ? t.notFound : copy.board.signIn}</p>
      </div>
    );
  }
  if (!player) return <div className="page-skeleton" aria-busy="true" aria-label={t.loading} />;

  const d = player.details;
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
      router.push("/leaderboard");
    } catch {
      toast(copy.auth.errors.generic);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page page-narrow player-page">
      <TopBar title={player.name} backHref="/leaderboard" />
      <Card className="player-card">
        <div className="player-banner" style={{ background: bannerVar(d.banner) }} />
        <div className="player-head">
          <span className="player-face">
            <MemberFace id={player.avatar} photo={player.photo} size={84} />
          </span>
          <h2 className="player-name">
            {player.name}
            {player.country ? <span aria-label={countryName(player.country)}> {flagOf(player.country)}</span> : null}
          </h2>
          {player.country ? <p className="muted small">{countryName(player.country)}</p> : null}
          {d.bio ? <p className="player-bio">{d.bio}</p> : null}
          <p className="muted small">{t.joined(new Date(player.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" }))}</p>
        </div>
      </Card>
      <Card as="div">
        <ul className="player-stats">
          <li>
            <strong>{player.rating ?? "–"}</strong>
            <span>{t.rating}</span>
          </li>
          <li>
            <strong>{player.xp}</strong>
            <span>{t.xp}</span>
          </li>
        </ul>
      </Card>
      {facts.length ? (
        <Card as="div">
          <dl className="player-facts">
            {facts.map((f) => (
              <div key={f.label}>
                <dt className="muted small">{f.label}</dt>
                <dd>{f.value}</dd>
              </div>
            ))}
          </dl>
        </Card>
      ) : null}
      {links.length ? (
        <Card className="list" aria-labelledby="links-h">
          <h2 id="links-h" className="card-title list-title">
            {t.links}
          </h2>
          {links.map((n) => (
            <a key={n} className="row" href={socialUrl(n, d.socials[n]!)} target="_blank" rel="noopener noreferrer nofollow">
              <span className="row-text">
                <span className="row-label">{copy.profileEdit.networks[n]}</span>
                <span className="row-hint">@{d.socials[n]}</span>
              </span>
            </a>
          ))}
        </Card>
      ) : null}
      {player.me ? (
        <Button block variant="secondary" icon="edit" href="/you/edit">
          {copy.profileEdit.open}
        </Button>
      ) : (
        <div className="player-actions">
          <Button block icon="profile" variant={player.friend ? "secondary" : "primary"} loading={busy && !confirmBlock} onClick={friend}>
            {player.friend ? t.removeFriend : t.addFriend}
          </Button>
          <Button block icon="flag" variant="secondary" href={`/class/report?player=${encodeURIComponent(player.id)}&name=${encodeURIComponent(player.name)}`}>
            {t.report}
          </Button>
          <Button block icon="block" variant="ghost" onClick={() => setConfirmBlock(true)}>
            {t.block}
          </Button>
        </div>
      )}
      <Sheet open={confirmBlock} onClose={() => setConfirmBlock(false)} labelledBy="block-title">
        <Cody animation="thinking" size={100} />
        <h2 id="block-title">{t.blockTitle(player.name)}</h2>
        <p>{t.blockBody}</p>
        <Button block variant="danger" icon="block" loading={busy} onClick={block}>
          {t.blockConfirm}
        </Button>
        <Button block variant="ghost" onClick={() => setConfirmBlock(false)}>
          {t.cancel}
        </Button>
      </Sheet>
    </div>
  );
}

export default function PlayerPage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <Player />
    </Suspense>
  );
}
