"use client";

import { selectDailyPuzzle, lockDailyPuzzle, themesForCompletedLessons, type Puzzle } from "@chessschool/chess";
import { usePuzzlePackReady } from "@/components/PuzzlePackBoot";
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

/** Today's puzzle. Passing `serve` records it so the same id is not offered again. Null until the pack is ready. */
export function useDailyPuzzle(serve = true): { today: string; puzzle: Puzzle | null; done: boolean; ready: boolean } {
  const { state, serveDailyPuzzle } = useApp();
  const ready = usePuzzlePackReady();
  const today = useLocalDay();
  const daily = state.progress.puzzles.daily;
  const choice = ready
    ? selectDailyPuzzle({
        day: today,
        completedThemes: themesForCompletedLessons(Object.keys(state.progress.completed)),
        seenIds: daily.seen ?? [],
        servedDay: daily.servedDay,
        servedId: daily.servedId,
        stored: (daily.served as Puzzle | undefined) ?? null,
      })
    : { puzzle: null, persist: false };
  useEffect(() => {
    if (!serve || !ready || !choice.persist || !choice.puzzle) return;
    lockDailyPuzzle(today, choice.puzzle);
    serveDailyPuzzle(today, choice.puzzle.id, choice.puzzle);
  }, [serve, ready, choice.persist, choice.puzzle, today, serveDailyPuzzle]);
  return { today, puzzle: choice.puzzle, done: dailyDone(state.progress, today), ready };
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
