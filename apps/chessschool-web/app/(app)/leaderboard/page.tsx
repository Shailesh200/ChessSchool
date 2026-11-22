"use client";

import { copy, flagOf, type BoardMetric, type BoardResponse, type BoardRow, type BoardScope } from "@chessschool/design";
import Link from "next/link";
import { isOfflineError } from "@chessschool/design";
import { useCallback, useEffect, useState } from "react";
import { MemberFace } from "@/components/MemberFace";
import { Icon } from "@/components/Icon";
import { Button, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

/** Global, country and friends boards, ranked by XP this week, rating or the strongest bot beaten. */
export default function LeaderboardPage() {
  const { state, ready } = useApp();
  const toast = useToast();
  const t = copy.board;
  const country = state.profile.country ?? null;
  const [scope, setScope] = useState<BoardScope>("global");
  const [metric, setMetric] = useState<BoardMetric>("xp");
  const [board, setBoard] = useState<BoardResponse | null>(null);
  const [failed, setFailed] = useState<false | "offline" | "error">(false);
  const load = useCallback(() => {
    setBoard(null);
    setFailed(false);
    api
      .board(scope, metric)
      .then(setBoard)
      .catch((err) => setFailed(isOfflineError(err) ? "offline" : "error"));
  }, [scope, metric]);
  useEffect(() => {
    if (ready && state.account) load();
  }, [load, ready, state.account, country]);

  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const addFriend = (r: BoardRow) => {
    api
      .addFriend(r.id)
      .then(() => {
        toast(t.added(r.name));
        setBoard((b) => (b ? { ...b, rows: b.rows.map((x) => (x.id === r.id ? { ...x, friend: true } : x)) } : b));
      })
      .catch(() => toast(copy.auth.errors.generic));
  };
  const scopes: [BoardScope, string][] = [
    ["global", t.global],
    ["country", country ? `${flagOf(country)} ${t.country}` : t.country],
    ["friends", t.friends],
  ];
  const metrics: [BoardMetric, string][] = [
    ["xp", t.xp],
    ["rating", t.rating],
    ["wins", t.wins],
  ];
  return (
    <div className="page page-narrow board-page">
      <TopBar title={t.title} />
      {!state.account ? (
        <p>{t.signIn}</p>
      ) : (
        <>
          <div className="board-scopes" role="tablist" aria-label={t.title}>
            {scopes.map(([id, label]) => (
              <button key={id} type="button" role="tab" aria-selected={scope === id} className={scope === id ? "is-on" : ""} onClick={() => setScope(id)}>
                {label}
              </button>
            ))}
          </div>
          <div className="board-metrics" role="radiogroup" aria-label={t.title}>
            {metrics.map(([id, label]) => (
              <button key={id} type="button" role="radio" aria-checked={metric === id} className={metric === id ? "is-on" : ""} onClick={() => setMetric(id)}>
                {label}
              </button>
            ))}
          </div>
          {failed ? (
            <div className="board-note">
              <p role="alert">{failed === "offline" ? copy.offlineMode.needsConnection : copy.auth.errors.generic}</p>
              <Button variant="secondary" onClick={load}>
                {copy.puzzles.retry}
              </Button>
            </div>
          ) : !board ? (
            <div className="page-skeleton" aria-busy="true" />
          ) : board.needsCountry ? (
            <div className="board-note">
              <p className="muted">{t.needsCountry}</p>
              <Button href="/country" icon="flag">
                {t.pickCountry}
              </Button>
            </div>
          ) : board.rows.length === 0 ? (
            <p className="muted">{scope === "friends" ? t.friendsEmpty : t.empty}</p>
          ) : (
            <ol className="board-rows">
              {board.rows.map((r) => (
                <li key={r.id} className={`${r.me ? "is-me" : ""}${r.rank <= 3 ? ` is-top rank-${r.rank}` : ""}`}>
                  <span className="board-rank">{r.rank}</span>
                  <MemberFace id={r.avatar} photo={r.photo} size={40} />
                  <Link className="board-name" href={`/player?id=${encodeURIComponent(r.id)}`} aria-label={copy.social.viewProfile(r.me ? t.you : r.name)}>
                    <strong>
                      {r.me ? t.you : r.name}
                      {r.country ? <span aria-label={r.country}> {flagOf(r.country)}</span> : null}
                    </strong>
                    {r.friend ? <span className="muted small">{t.friend}</span> : null}
                  </Link>
                  <span className="board-value">{t.value(metric, r.value)}</span>
                  {!r.me && !r.friend ? (
                    <button type="button" className="board-add" aria-label={t.add(r.name)} onClick={() => addFriend(r)}>
                      <Icon name="profile" size={16} />
                    </button>
                  ) : null}
                </li>
              ))}
            </ol>
          )}
          {board && !board.needsCountry && !board.rows.some((r) => r.me) ? (
            <div className="board-me">
              <strong>{board.me.rank ? `#${board.me.rank}` : "–"}</strong>
              <span>{board.me.rank ? t.you : t.unranked}</span>
              {board.me.value ? <strong>{t.value(metric, board.me.value)}</strong> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
