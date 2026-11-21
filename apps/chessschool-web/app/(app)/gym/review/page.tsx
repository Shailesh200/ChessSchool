"use client";

import { isBotId, opponentName, parseSetup } from "@chessschool/chess";
import { ALL_GAMES, botsInLog, copy, filterGames, GAME_KINDS, GAME_RESULTS, gameKind, type GameFilter } from "@chessschool/design";
import { botInfo } from "@chessschool/chess";
import { useState } from "react";
import Link from "next/link";
import { BotAvatar } from "@/components/BotAvatar";
import { Cody } from "@/components/Lottie";
import { Button, Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function ReviewList() {
  const { state, ready } = useApp();
  const [filter, setFilter] = useState<GameFilter>(ALL_GAMES);
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const games = filterGames(state.gameLog, filter);
  const bots = botsInLog(state.gameLog).filter(isBotId);
  const chip = (key: string, label: string, on: boolean, onClick: () => void) => (
    <li key={key}>
      <button type="button" className="filter-chip" aria-pressed={on} onClick={onClick}>
        {label}
      </button>
    </li>
  );
  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym" title={copy.myGames.title} />
      <Button variant="secondary" icon="history" href="/gym/import">
        {copy.gym.importCta}
      </Button>
      <Button variant="secondary" icon="eye" href="/gym/scan">
        {copy.scan.cta}
      </Button>
      {state.gameLog.length ? (
        <>
          <ul className="filter-row" aria-label={copy.myGames.kindLabel}>
            {(["all", ...GAME_KINDS] as const).map((k) => chip(k, copy.myGames.kinds[k], filter.kind === k, () => setFilter({ ...filter, kind: k, bot: null })))}
          </ul>
          <ul className="filter-row" aria-label={copy.myGames.resultLabel}>
            {(["all", ...GAME_RESULTS] as const).map((r) => chip(r, copy.myGames.results[r], filter.result === r, () => setFilter({ ...filter, result: r })))}
          </ul>
          {filter.kind === "bot" && bots.length > 1 ? (
            <ul className="filter-row" aria-label={copy.myGames.botLabel}>
              {chip("any", copy.myGames.anyBot, !filter.bot, () => setFilter({ ...filter, bot: null }))}
              {bots.map((b) => chip(b, botInfo(b).name, filter.bot === b, () => setFilter({ ...filter, bot: b })))}
            </ul>
          ) : null}
        </>
      ) : null}
      {games.length ? (
        <ul className="game-list">
          {games.map((g) => {
            const setup = parseSetup(g.setup);
            if (!setup) return null;
            const bot = setup.opponent.kind === "bot" ? setup.opponent.bot : null;
            const scanned = g.reason === "scanned";
            const result = g.winner === null ? copy.play.results.draw.title : setup.opponent.kind === "friend" ? copy.gym.friendWin(copy.play.sides[g.winner]) : g.winner === setup.you ? copy.play.results.win.title : copy.play.results.loss.title;
            return (
              <li key={g.id}>
                <Link href={`/gym/review/${encodeURIComponent(g.id)}`} className="game-row">
                  {bot && isBotId(bot) ? <BotAvatar bot={bot} /> : <span className="player-avatar">{setup.opponent.kind === "online" ? "@" : "2P"}</span>}
                  <span className="game-row-text">
                    <strong>{scanned ? copy.scan.savedTitle : gameKind(g) === "challenge" ? copy.myGames.vsChallenge : setup.opponent.kind === "friend" ? copy.gym.vsFriend : setup.opponent.kind === "online" ? copy.gym.vsOnline : copy.play.vs(opponentName(setup))}</strong>
                    <span className="muted">
                      {scanned ? "" : `${result} · ${copy.gym.moveCount(Math.ceil(g.history.length / 2))} · `}
                      {new Date(g.endedAt).toLocaleDateString()}
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <Card className="room-detail tint-brand">
          <Cody animation="reading" size={140} label={copy.a11y.mascot} />
          <p className="lead">{state.gameLog.length ? copy.myGames.none : copy.gym.reviewEmpty}</p>
        </Card>
      )}
    </div>
  );
}
