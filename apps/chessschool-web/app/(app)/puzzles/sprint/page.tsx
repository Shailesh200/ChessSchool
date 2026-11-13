"use client";

import { nextPuzzle, type Puzzle } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Cody } from "@/components/Lottie";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, Card, TopBar } from "@/components/ui";
import { usePuzzlePackReady } from "@/components/PuzzlePackBoot";
import { useApp } from "@/lib/state";

const SECONDS = 180;
const LIVES = 3;

export default function SprintPage() {
  const { ready } = useApp();
  const packReady = usePuzzlePackReady();
  if (!ready || !packReady) return <div className="page-skeleton" aria-busy="true" />;
  return <Sprint />;
}

/** Puzzle sprint: 3 minutes, 3 mistakes, puzzles get harder as you go. */
function Sprint() {
  const { state, finishSprint, cue } = useApp();
  const [run, setRun] = useState(0);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(LIVES);
  const [puzzle, setPuzzle] = useState<Puzzle | null>(null);
  const [endsAt, setEndsAt] = useState(0);
  const [now, setNow] = useState(0);
  const [best, setBest] = useState(state.progress.puzzles.sprintBest);
  const [finished, setFinished] = useState(false);
  const seen = useRef<string[]>([]);

  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const over = finished || (puzzle !== null && (left === 0 || lives === 0));

  const pickNext = (solvedSoFar: number) => {
    const p = nextPuzzle({ rating: 500 + solvedSoFar * 60, exclude: seen.current });
    seen.current.push(p.id);
    setPuzzle(p);
  };

  const start = () => {
    seen.current = [];
    setScore(0);
    setLives(LIVES);
    setFinished(false);
    const t = Date.now();
    setEndsAt(t + SECONDS * 1000);
    setNow(t);
    setRun((r) => r + 1);
    pickNext(0);
  };

  useEffect(() => {
    if (!puzzle || over) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [puzzle, over]);

  // Record once when the run ends.
  useEffect(() => {
    if (!over || finished || !puzzle) return;
    setFinished(true);
    setBest((b) => Math.max(b, score));
    finishSprint(score, (SECONDS - left) / 60 || 1);
    cue(score > best ? "level-up" : "success");
    // Only the transition into "over" matters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [over]);

  if (!puzzle || finished) {
    return (
      <div className="page page-narrow">
        <TopBar backHref="/puzzles" title={copy.puzzles.sprint} />
        <Card className="room-detail tint-gold">
          <Cody animation={finished ? "celebrate" : "wow"} size={150} label={copy.a11y.mascot} />
          <h1>{finished ? copy.puzzles.sprintOver : copy.puzzles.sprint}</h1>
          <p className="lead">{finished ? copy.puzzles.sprintScore(score) : copy.puzzles.sprintBody}</p>
          {finished && score >= best && score > 0 ? <p className="beat-tag">{copy.puzzles.newBest}</p> : null}
          <p className="muted">{copy.puzzles.sprintBest(Math.max(best, finished ? score : 0))}</p>
          <Button icon="bolt" onClick={start}>
            {finished ? copy.puzzles.sprintAgain : copy.puzzles.sprint}
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="page play-page">
      <TopBar backHref="/puzzles" title={copy.puzzles.sprint} />
      <div className="play puzzle-play">
        <PuzzlePlayer
          key={`${run}-${puzzle.id}`}
          puzzle={puzzle}
          sprint
          top={
            <div className="player">
              <span className={`clock is-running${left < 20 ? " is-low" : ""}`} role="timer">
                {copy.puzzles.timeLeft(left)}
              </span>
              <p className="stage-status">{copy.puzzles.sprintScore(score)}</p>
              <span className="chip chip-accent">{copy.puzzles.sprintLives(lives)}</span>
            </div>
          }
          onResult={(solved) => {
            const nextScore = solved ? score + 1 : score;
            if (solved) setScore(nextScore);
            else setLives((l) => l - 1);
            // Short pause so the result registers, then the next puzzle.
            setTimeout(() => pickNext(nextScore), solved ? 500 : 900);
          }}
        />
      </div>
    </div>
  );
}
