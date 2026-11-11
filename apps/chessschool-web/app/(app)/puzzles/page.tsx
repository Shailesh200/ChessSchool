"use client";

import { allPuzzles, dailyPuzzle, PUZZLE_THEMES, themeCount } from "@chessschool/chess";
import { copy, dailyDone, dayKey } from "@chessschool/design";
import Link from "next/link";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function PuzzlesPage() {
  const { state, ready } = useApp();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  const pz = state.progress.puzzles;
  const today = dayKey(new Date());
  const done = dailyDone(state.progress, today);
  const daily = dailyPuzzle(today);
  return (
    <div className="page">
      <TopBar title={copy.puzzles.title} large back={false} />
      <p className="page-lead">{`${copy.puzzles.body} ${copy.puzzles.themeCount(allPuzzles().length)}`}</p>

      <div className="puzzle-hub">
        <Card className="gym-hero">
          <div>
            <p className="hero-label">{copy.puzzles.rating}</p>
            <h2 className="rating-big">{pz.rating}</h2>
            <p className="muted">{copy.puzzles.solvedCount(pz.solved)}</p>
            <Button href="/puzzles/solve" icon="puzzle">
              {copy.puzzles.play}
            </Button>
          </div>
          <Cody animation="thinking" size={110} className="gym-hero-cody" />
        </Card>

        <Card className={`daily-card${done ? " is-done" : ""}`}>
          <h2 className="card-title">
            <Icon name="sun" /> {copy.puzzles.daily}
          </h2>
          <p className="muted">{done ? copy.puzzles.dailyDone : copy.puzzles.dailyBody}</p>
          <p className="chip chip-accent">{copy.puzzles.dailyStreak(pz.daily.count)}</p>
          {done ? null : (
            <Button href={`/puzzles/solve?daily=1`} icon="play" variant="gold">
              {copy.puzzles.daily} · {daily.rating}
            </Button>
          )}
        </Card>

        <Card>
          <h2 className="card-title">
            <Icon name="clock" /> {copy.puzzles.sprint}
          </h2>
          <p className="muted">{copy.puzzles.sprintBody}</p>
          <p className="chip chip-gold">{copy.puzzles.sprintBest(pz.sprintBest)}</p>
          <Button href="/puzzles/sprint" icon="bolt" variant="accent">
            {copy.puzzles.sprint}
          </Button>
        </Card>
      </div>

      <section className="gym-section" aria-labelledby="themes-title">
        <h2 id="themes-title" className="card-title">
          {copy.puzzles.themes}
        </h2>
        <ul className="modes">
          {PUZZLE_THEMES.map((t) => (
            <li key={t.id}>
              <Link href={`/puzzles/solve?theme=${t.id}`} className="mode-tile">
                <span className="mode-name">{t.name}</span>
                <span className="mode-body">{t.blurb}</span>
                <span className="mode-body">{copy.puzzles.themeCount(themeCount(t.id))}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
