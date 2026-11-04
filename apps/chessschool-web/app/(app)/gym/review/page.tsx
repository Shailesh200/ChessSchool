"use client";

import { isBotId, opponentName, parseSetup } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import Link from "next/link";
import { BotAvatar } from "@/components/BotAvatar";
import { Cody } from "@/components/Lottie";
import { Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function ReviewList() {
  const { state, ready } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const games = state.gameLog;
  return (
    <div className="page page-narrow">
      <TopBar backHref="/gym" title={copy.gym.review.name} />
      {games.length ? (
        <ul className="game-list">
          {games.map((g) => {
            const setup = parseSetup(g.setup);
            if (!setup) return null;
            const bot = setup.opponent.kind === "bot" ? setup.opponent.bot : null;
            const result = g.winner === null ? copy.play.results.draw.title : setup.opponent.kind === "friend" ? copy.gym.friendWin(copy.play.sides[g.winner]) : g.winner === setup.you ? copy.play.results.win.title : copy.play.results.loss.title;
            return (
              <li key={g.id}>
                <Link href={`/gym/review/${encodeURIComponent(g.id)}`} className="game-row">
                  {bot && isBotId(bot) ? <BotAvatar bot={bot} /> : <span className="player-avatar">2P</span>}
                  <span className="game-row-text">
                    <strong>{setup.opponent.kind === "friend" ? copy.gym.vsFriend : copy.play.vs(opponentName(setup))}</strong>
                    <span className="muted">
                      {result} · {copy.gym.moveCount(Math.ceil(g.history.length / 2))} · {new Date(g.endedAt).toLocaleDateString()}
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
          <p className="lead">{copy.gym.reviewEmpty}</p>
        </Card>
      )}
    </div>
  );
}
