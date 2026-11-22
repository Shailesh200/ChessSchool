"use client";

import { botInfo, isBotId } from "@chessschool/chess";
import { CARD_BACKDROPS, closeRecap, copy, showRecapCard, visibleDailyStreak, weeklyRecap, type WeeklyRecap } from "@chessschool/design";
import { DailyCountdown, useDailyPuzzle } from "@/components/DailyCountdown";
import { Icon } from "@/components/Icon";
import { Button, Card, Chip } from "@/components/ui";
import { useApp } from "@/lib/state";
import { Backdrop } from "./Backdrop";

const botRating = (id: string) => (isBotId(id) ? botInfo(id).rating : 0);
export const botName = (id: string) => (isBotId(id) ? botInfo(id).name : id);

/** The shared daily puzzle: how many solved it today, the puzzle streak and its freezes. */
export function DailyCard({ today, enabled = true, className = "" }: { today: string; enabled?: boolean; className?: string }) {
  const { state } = useApp();
  const { puzzle, done, solved } = useDailyPuzzle(enabled);
  const streak = visibleDailyStreak(state.progress, today);
  const freezes = state.progress.puzzles.daily.freezes ?? 0;
  return (
    <Card className={`daily-panel has-art ${className}`} aria-labelledby="daily-title">
      <Backdrop art={CARD_BACKDROPS.hero} />
      <h2 id="daily-title" className="card-title">
        <Icon name={done ? "check" : "sun"} /> {copy.dailyPuzzle.title}
      </h2>
      <p className="muted">{done ? copy.dailyPuzzle.doneToday : puzzle ? `${copy.dailyPuzzle.body} · ${puzzle.rating}` : copy.dailyPuzzle.body}</p>
      {solved !== null ? <p className="muted small">{solved ? copy.dailyPuzzle.solvedBy(solved) : copy.dailyPuzzle.beFirst}</p> : null}
      <div className="chip-row">
        <Chip icon="spark" tone={streak ? "accent" : "neutral"}>
          {copy.dailyPuzzle.streak(streak)}
        </Chip>
        {freezes ? (
          <Chip icon="snow" tone="brand" label={copy.dailyPuzzle.freezesLabel(freezes)}>
            {copy.dailyPuzzle.freezes(freezes)}
          </Chip>
        ) : null}
      </div>
      {done ? (
        <DailyCountdown />
      ) : (
        <Button href="/puzzles/solve?daily=1" variant="gold" icon="puzzle" block>
          {copy.dailyPuzzle.solve}
        </Button>
      )}
    </Card>
  );
}

const fmt = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" });

export function RecapSummary({ recap }: { recap: WeeklyRecap }) {
  const stats: [string, string][] = [
    [copy.recap.xp, String(recap.xp)],
    [copy.recap.lessons, String(recap.lessons)],
    [copy.recap.puzzles, String(recap.puzzles)],
    [copy.recap.games, String(recap.games)],
    [copy.recap.rating, copy.recap.change(recap.ratingChange)],
  ];
  const b = recap.best;
  const best = !b ? copy.recap.noBest : b.kind === "win" ? copy.recap.bestWin(botName(b.bot)) : b.kind === "daily" ? copy.recap.bestDaily(b.days) : copy.recap.bestLessons(b.count);
  return (
    <>
      <p className="muted small">{copy.recap.range(fmt(recap.week), fmt(recap.to))}</p>
      <ul className="stat-grid" style={{ listStyle: "none", margin: 0, padding: 0 }}>
        {stats.map(([label, value]) => (
          <li key={label} className="stat-tile" aria-label={`${label}: ${value}`}>
            <strong aria-hidden>{value}</strong>
            <span aria-hidden>{label}</span>
          </li>
        ))}
      </ul>
      <p className="card-head">
        <Icon name="star" /> <strong>{`${copy.recap.best}: ${best}`}</strong>
      </p>
    </>
  );
}

export const useRecap = (today: string) => {
  const { state } = useApp();
  return weeklyRecap(state, today, botRating);
};

/** Monday to Wednesday on Today: last week's recap, until it is closed. */
export function RecapCard({ today }: { today: string }) {
  const { state, update } = useApp();
  const recap = useRecap(today);
  if (!recap || !showRecapCard(state, recap, today)) return null;
  return (
    <Card className="recap-card tint-brand" aria-labelledby="recap-title">
      <div className="card-head">
        <h2 id="recap-title" className="card-title">
          {copy.recap.cardTitle}
        </h2>
        <button type="button" className="icon-btn" aria-label={copy.recap.close} onClick={() => update((s) => closeRecap(s, recap.week))}>
          <Icon name="close" />
        </button>
      </div>
      <RecapSummary recap={recap} />
      <Button href="/recap" variant="secondary" icon="chevron" block>
        {copy.recap.see}
      </Button>
    </Card>
  );
}
