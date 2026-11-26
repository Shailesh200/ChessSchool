"use client";

import { CARD_BACKDROPS, copy, rankFor, RANKS } from "@chessschool/design";
import Link from "next/link";
import { RankEmblem } from "./RankEmblem";
import { Icon } from "./Icon";
import { Backdrop } from "./Backdrop";


/** Learn: "Your rank". The current rank's emblem, progress to the next rank, the six-rank ladder and three stats. */
export function RankCard({ xp, streak, rating, puzzleRating }: { xp: number; streak: number; rating: number; puzzleRating: number }) {
  const r = rankFor(xp);
  const goal = r.next ? RANKS[r.index + 1].xp : xp;
  const stats: [string, string][] = [
    [String(streak), copy.today.statStreak],
    [String(rating), copy.today.statRating],
    [String(puzzleRating), copy.today.statPuzzles],
  ];
  return (
    <section className="card rank-card has-art" aria-labelledby="rank-title">
      <Backdrop art={CARD_BACKDROPS.rank} />
      <div className="rank-card-top">
        <h2 id="rank-title" className="eyebrow">
          {copy.today.rankTitle}
        </h2>
        <span className="muted small">{copy.today.rankStep(r.index + 1, RANKS.length)}</span>
      </div>
      <div className="rank-card-hero">
        <RankEmblem rank={r.rank} size={104} />
        <div className="rank-card-name">
          <strong>{copy.ranks[r.rank]}</strong>
          <span className="muted small">{copy.today.rankXp(xp)}</span>
          <span className="rank-next">{r.next ? copy.today.rankToNext(r.toNext, copy.ranks[r.next]) : copy.today.rankTop}</span>
        </div>
      </div>
      <div className="rank-bar" role="progressbar" aria-valuemin={0} aria-valuemax={goal} aria-valuenow={xp} aria-label={copy.today.rankBar(xp, goal)}>
        <span style={{ width: `${Math.round(r.fraction * 100)}%` }} />
      </div>
      <ol className="rank-ladder" aria-label={copy.today.rankTitle}>
        {RANKS.map((rank, i) => (
          <li key={rank.id} className={i < r.index ? "is-done" : i === r.index ? "is-now" : ""} aria-current={i === r.index ? "step" : undefined}>
            <RankEmblem rank={rank.id} size={i === r.index ? 40 : 34} />
            {copy.ranks[rank.id]}
          </li>
        ))}
      </ol>
      <div className="rank-stats">
        {stats.map(([value, label]) => (
          <div key={label}>
            <strong>{value}</strong>
            <span>{label}</span>
          </div>
        ))}
      </div>
      <Link href="/leaderboard" className="rank-board-link">
        <Icon name="trophy" size={20} />
        <span>{copy.board.open}</span>
        <Icon name="chevron" size={20} />
      </Link>
    </section>
  );
}
