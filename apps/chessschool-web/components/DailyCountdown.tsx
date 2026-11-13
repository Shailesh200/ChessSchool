"use client";

import { dailyPuzzle, puzzleById, themesForCompletedLessons, type Puzzle } from "@chessschool/chess";
import { usePuzzlePackVersion } from "@/components/PuzzlePackBoot";
import { copy, dailyDone, dayKey, formatDailyCountdown, msUntilLocalMidnight, watchLocalMidnight } from "@chessschool/design";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/state";

/** Local day, replaced at midnight and when the tab is shown again (a background timer may have been paused). */
function useLocalDay(): string {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const watch = watchLocalMidnight((day) => setToday(day));
    const onWake = () => {
      if (document.visibilityState === "visible") watch.sync();
    };
    document.addEventListener("visibilitychange", onWake);
    window.addEventListener("focus", onWake);
    return () => {
      watch.stop();
      document.removeEventListener("visibilitychange", onWake);
      window.removeEventListener("focus", onWake);
    };
  }, []);
  return today;
}

/** Today's puzzle. Passing `serve` records it so the same id is not offered again. */
export function useDailyPuzzle(serve = true): { today: string; puzzle: Puzzle; done: boolean } {
  const { state, serveDailyPuzzle } = useApp();
  usePuzzlePackVersion();
  const today = useLocalDay();
  const daily = state.progress.puzzles.daily;
  const stuck = daily.servedDay === today && daily.servedId ? puzzleById(daily.servedId) : null;
  const puzzle = stuck ?? dailyPuzzle(today, themesForCompletedLessons(Object.keys(state.progress.completed)), daily.seen ?? []);
  useEffect(() => {
    if (!serve || stuck) return;
    serveDailyPuzzle(today, puzzle.id);
  }, [serve, stuck, today, puzzle.id, serveDailyPuzzle]);
  return { today, puzzle, done: dailyDone(state.progress, today) };
}

/** Live time until local midnight, shown once today's daily puzzle is solved. */
export function DailyCountdown() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const label = copy.puzzles.dailyCountdown(formatDailyCountdown(msUntilLocalMidnight(new Date(now))));
  return (
    <p className="muted daily-countdown" role="timer">
      {label}
    </p>
  );
}
