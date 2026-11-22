"use client";

import { PUZZLE_THEMES } from "@chessschool/chess";
import { CARD_BACKDROPS, copy } from "@chessschool/design";
import Link from "next/link";
import { useDailyPuzzle } from "@/components/DailyCountdown";
import { DailyCard } from "@/components/Daily";
import { Icon } from "@/components/Icon";
import { Cody } from "@/components/Lottie";
import { Button, Card, TopBar } from "@/components/ui";
import { usePuzzlePackReady } from "@/components/PuzzlePackBoot";
import { useApp } from "@/lib/state";
import { Backdrop } from "@/components/Backdrop";

export default function PuzzlesPage() {
  const { state, ready } = useApp();
  const packReady = usePuzzlePackReady();
  const pz = state.progress.puzzles;
  const { puzzle: daily, today } = useDailyPuzzle(ready && packReady);
  if (!ready || !packReady || !daily) return <div className="page-skeleton" aria-busy="true" />;
  return (
    <div className="page">
      <TopBar title={copy.puzzles.title} large back={false} />
      <p className="page-lead">{copy.puzzles.body}</p>

      <div className="puzzle-hub">
        <Card className="gym-hero has-art">
          <Backdrop art={CARD_BACKDROPS.rating} />
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

        <DailyCard today={today} enabled={ready && packReady} className="daily-card" />

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
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
