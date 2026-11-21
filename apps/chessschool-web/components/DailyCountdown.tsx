"use client";

import { puzzleById, selectDailyPuzzle, lockDailyPuzzle, type Puzzle, type PuzzleThemeId } from "@chessschool/chess";
import { usePuzzlePackReady } from "@/components/PuzzlePackBoot";
import { copy, dailyDone, dayKey, formatDailyCountdown, msUntilLocalMidnight, watchLocalMidnight } from "@chessschool/design";
import { useEffect, useState } from "react";
import { useApp } from "@/lib/state";
import { api } from "@/lib/api";

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

/**
 * Today's shared daily puzzle (the same for everyone, picked by date from the pack; the API's pick wins when
 * it is reachable, so a device on an older pack still gets everyone's puzzle). Passing `serve` locks it for the
 * day. `solved` is how many learners solved it today (null offline). Null puzzle until the pack is ready.
 */
export function useDailyPuzzle(serve = true): { today: string; puzzle: Puzzle | null; done: boolean; ready: boolean; solved: number | null } {
  const { state, serveDailyPuzzle } = useApp();
  const ready = usePuzzlePackReady();
  const today = useLocalDay();
  const daily = state.progress.puzzles.daily;
  const choice = ready
    ? selectDailyPuzzle({
        day: today,
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
  const done = dailyDone(state.progress, today);
  const [remote, setRemote] = useState<{ day: string; puzzle: Puzzle; solved: number } | null>(null);
  useEffect(() => {
    let live = true;
    api
      .daily(today)
      .then((r) => live && setRemote({ day: r.day, puzzle: { ...r.puzzle, themes: r.puzzle.themes as PuzzleThemeId[] }, solved: r.solved }))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [today, done]);
  const remotePuzzle = remote?.day === today ? remote.puzzle : null;
  useEffect(() => {
    // Only a puzzle this device can show for the rest of the day (in its pack, or small enough to keep as a snapshot).
    if (!serve || !remotePuzzle || done || daily.servedId === remotePuzzle.id || (!puzzleById(remotePuzzle.id) && !/^[A-Za-z0-9-]{3,8}$/.test(remotePuzzle.id))) return;
    lockDailyPuzzle(today, remotePuzzle);
    serveDailyPuzzle(today, remotePuzzle.id, remotePuzzle);
  }, [serve, remotePuzzle, done, daily.servedId, today, serveDailyPuzzle]);
  return { today, puzzle: choice.puzzle, done, ready, solved: remote?.day === today ? remote.solved : null };
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
