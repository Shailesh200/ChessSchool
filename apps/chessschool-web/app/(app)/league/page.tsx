"use client";

import { closesIn, copy, isAvatarId, PROMOTE, pushCelebration, RELEGATE, type LeagueResponse } from "@chessschool/design";
import { useEffect, useState } from "react";
import { MemberFace } from "@/components/MemberFace";
import { Button, Card, TopBar } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

export default function LeaguePage() {
  const { state, ready, update } = useApp();
  const t = copy.leagues;
  const [res, setRes] = useState<LeagueResponse | "offline" | null>(null);
  const signedIn = Boolean(state.account) && !state.activeChild;

  useEffect(() => {
    if (!ready || !signedIn) return;
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
  }, [ready, signedIn]);

  let body: React.ReactNode;
  if (!ready) body = null;
  else if (!state.account || (res !== "offline" && res?.status === "guest"))
    body = (
      <Card aria-labelledby="league-guest">
        <h2 id="league-guest" className="card-title">
          {t.guestTitle}
        </h2>
        <p className="muted">{t.guestBody}</p>
        <Button block href="/signup" icon="shield">
          {t.signup}
        </Button>
      </Card>
    );
  else if (res === "offline") body = <p className="muted">{t.offline}</p>;
  else if (!res) body = <p className="muted" aria-busy="true" />;
  else if (res.status === "none")
    body = (
      <Card>
        <p className="muted">{t.notJoined}</p>
        <Button block href="/today" icon="learn">
          {copy.lesson.back}
        </Button>
      </Card>
    );
  else if (res.status === "joined") {
    const { league } = res;
    const left = closesIn(league.week, Date.now());
    body = (
      <>
        <div className="league-head">
          <h2 className="card-title">{t.tiers[league.tier]}</h2>
          <span className="chip chip-gold">{t.closes(left.days, left.hours, left.minutes)}</span>
        </div>
        <p className="muted">
          {t.upHint(PROMOTE)} {league.tier !== "pawn" ? t.downHint(RELEGATE) : null}
        </p>
        <ol className="league-table" aria-label={t.members(league.members.length)}>
          {league.members.map((m) => (
            <li key={m.place} className={`zone-${m.zone}${m.you ? " me" : ""}`} aria-label={t.rowA11y(m.place, m.you ? t.you : m.name, m.xp)}>
              <span className="league-place">{t.place(m.place)}</span>
              <MemberFace id={isAvatarId(m.avatar) ? m.avatar : "cody"} size={28} />
              <span className="league-name">{m.you ? `${m.name} (${t.you})` : m.name}</span>
              {m.zone !== "stay" ? <span className="league-zone">{m.zone === "up" ? t.up : t.down}</span> : null}
              <strong>{t.xp(m.xp)}</strong>
            </li>
          ))}
        </ol>
      </>
    );
  }

  return (
    <div className="page page-narrow">
      <TopBar title={t.title} backHref="/today" />
      {body}
    </div>
  );
}
