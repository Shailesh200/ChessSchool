"use client";

import { copy, countryName, isUnitBadge, rankFor, SOCIALS, socialUrl, type BadgeId, type IconName, type PlayerGame, type PlayerProfile } from "@chessschool/design";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { botName } from "@/components/Daily";
import { Icon } from "@/components/Icon";
import { MemberFace } from "@/components/MemberFace";
import { bannerVar } from "@/components/Social";
import { Cody } from "@/components/Lottie";
import { Button, Card, Sheet, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** A player's public profile (leaderboard row, friend, link): rank, stats, trophies, recent games, details, links, and add friend / report / block. */
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

  const rank = rankFor(player.xp);
  const trophies = (player.badges ?? []).filter((b) => !isUnitBadge(b as BadgeId) && b in copy.badges.list) as BadgeId[];
  const stats: { label: string; value: string | number; icon: IconName; tone: string }[] = [
    { label: t.streak, value: player.streak ?? 0, icon: "spark", tone: "accent" },
    { label: t.xp, value: player.xp, icon: "bolt", tone: "gold" },
    { label: t.lessons, value: player.lessons ?? 0, icon: "learn", tone: "success" },
    { label: t.playRating, value: player.rating ?? t.unrated, icon: "gym", tone: "brand" },
    { label: t.puzzleRating, value: player.puzzleRating ?? t.unrated, icon: "puzzle", tone: "brand" },
    { label: t.bestWin, value: player.bestWin ?? "–", icon: "trophy", tone: "gold" },
  ];
  const since = new Date(player.joinedAt).toLocaleDateString(undefined, { month: "long", year: "numeric" });
  const opponent = (g: PlayerGame) => (g.opponent.kind === "bot" ? t.vsBot(botName(g.opponent.bot)) : g.opponent.kind === "online" ? t.vsOnline : t.vsFriend);

  return (
    <div className="page page-narrow player-page">
      <TopBar title={player.name} backHref="/leaderboard" />
      <Card className="player-card">
        <div className="player-banner" style={{ background: bannerVar(d.banner) }}>
          <span className="player-rank-pill">{`${copy.ranks[rank.rank]} · ${player.xp} ${t.xp}`}</span>
        </div>
        <div className="player-head">
          <span className="player-face">
            <MemberFace id={player.avatar} photo={player.photo} size={92} country={player.country} />
          </span>
          <h2 className="player-name">{player.name}</h2>
          {player.username ? <p className="player-username">{t.at(player.username)}</p> : null}
          <div className="player-chips">
            <span className="player-chip is-brand">{copy.today.level(copy.ranks[rank.rank], rank.level)}</span>
            {player.country ? <span className="player-chip">{countryName(player.country)}</span> : null}
            {player.friend ? <span className="player-chip is-success">{t.friend}</span> : null}
          </div>
          {d.bio ? <p className="player-bio">{d.bio}</p> : null}
          <p className="muted small">{t.memberSince(since)}</p>
        </div>
      </Card>
      <Card as="div">
        <ul className="player-stat-grid">
          {stats.map((st) => (
            <li key={st.label} className={`tone-${st.tone}`}>
              <Icon name={st.icon} size={18} />
              <strong>{st.value}</strong>
              <span>{st.label}</span>
            </li>
          ))}
        </ul>
      </Card>
      <Card as="section" aria-labelledby="recent-h">
        <div className="player-section-head">
          <h2 id="recent-h" className="card-title">{t.recent}</h2>
          {player.games ? <span className="muted small">{t.games(player.games.played, player.games.won)}</span> : null}
        </div>
        {player.recent?.length ? (
          <ul className="player-games">
            {player.recent.map((g) => (
              <li key={g.id} className={`is-${g.result}`}>
                <span className="player-game-icon" aria-hidden>
                  <Icon name={g.result === "win" ? "trophy" : g.result === "loss" ? "close" : "gym"} size={18} />
                </span>
                <span className="player-game-text">
                  <strong>{opponent(g)}</strong>
                  <span className="muted small">{`${t.moves(g.moves)} · ${new Date(g.endedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}</span>
                </span>
                <span className="player-game-result">{t.results[g.result]}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.noGames}</p>
        )}
      </Card>
      <Card as="section" aria-labelledby="trophies-h">
        <h2 id="trophies-h" className="card-title">{`${t.trophies} · ${trophies.length}`}</h2>
        {trophies.length ? (
          <ul className="player-trophies">
            {trophies.slice(-8).reverse().map((b) => (
              <li key={b}>
                <Icon name="trophy" size={14} />
                {copy.badges.list[b].name}
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">{t.noTrophies}</p>
        )}
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
          <Button block icon="flag" variant="secondary" href={`/report?player=${encodeURIComponent(player.id)}&name=${encodeURIComponent(player.name)}`}>
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
