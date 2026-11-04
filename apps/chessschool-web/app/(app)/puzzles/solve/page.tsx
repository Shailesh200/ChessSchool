"use client";

import { dailyPuzzle, nextPuzzle, PUZZLE_THEMES, updateRating, type Puzzle, type PuzzleThemeId } from "@chessschool/chess";
import { copy, dayKey } from "@chessschool/design";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";

export default function SolvePage() {
  return (
    <Suspense fallback={<div className="page-skeleton" aria-busy="true" />}>
      <Solve />
    </Suspense>
  );
}

function Solve() {
  const { state, ready } = useApp();
  const params = useSearchParams();
  if (!ready) return <div className="page-skeleton" aria-busy="true" />;
  return <SolveRoom key={params.toString()} daily={params.get("daily") === "1"} theme={(PUZZLE_THEMES.find((t) => t.id === params.get("theme"))?.id ?? null) as PuzzleThemeId | null} rating={state.progress.puzzles.rating} recent={state.progress.puzzles.recent} />;
}

function SolveRoom({ daily, theme, rating, recent }: { daily: boolean; theme: PuzzleThemeId | null; rating: number; recent: string[] }) {
  const { state, finishPuzzle } = useApp();
  const [puzzle, setPuzzle] = useState<Puzzle>(() => (daily ? dailyPuzzle(dayKey(new Date())) : nextPuzzle({ rating, theme, exclude: recent })));
  const [round, setRound] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const title = daily ? copy.puzzles.daily : theme ? PUZZLE_THEMES.find((t) => t.id === theme)!.name : copy.puzzles.play;

  return (
    <div className="page play-page">
      <TopBar backHref="/puzzles" title={title} />
      <div className="play puzzle-play">
        <PuzzlePlayer
          key={`${puzzle.id}-${round}`}
          puzzle={puzzle}
          onResult={(solved) => {
            const pz = state.progress.puzzles;
            const newRating = updateRating(pz.rating, puzzle.rating, solved, pz.attempts);
            setDelta(newRating - pz.rating);
            finishPuzzle({ id: puzzle.id, solved, newRating, daily });
          }}
          actions={
            <>
              {delta !== null ? (
                <p className={`rating-delta${delta >= 0 ? " up" : " down"}`} role="status">
                  {copy.puzzles.rating} {state.progress.puzzles.rating} ({copy.puzzles.ratingChange(delta)})
                </p>
              ) : null}
              {daily ? (
                <Button block href="/puzzles" icon="back">
                  {copy.puzzles.back}
                </Button>
              ) : (
                <Button
                  block
                  icon="arrowRight"
                  onClick={() => {
                    setDelta(null);
                    setPuzzle(nextPuzzle({ rating: state.progress.puzzles.rating, theme, exclude: [puzzle.id, ...state.progress.puzzles.recent] }));
                    setRound((r) => r + 1);
                  }}
                >
                  {copy.puzzles.next}
                </Button>
              )}
            </>
          }
        />
      </div>
    </div>
  );
}
