import { selectDailyPuzzle, lockDailyPuzzle, themesForCompletedLessons, type Puzzle } from "@chessschool/chess";
import { usePuzzlePackReady } from "@/lib/puzzlePack";
import { copy, dailyDone, dayKey, formatDailyCountdown, msUntilLocalMidnight, watchLocalMidnight } from "@chessschool/design";
import { useEffect, useState } from "react";
import { AppState, View } from "react-native";
import { T } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Local day, replaced at midnight and when the app becomes active (a background timer may have been paused). */
function useLocalDay(): string {
  const [today, setToday] = useState(() => dayKey(new Date()));
  useEffect(() => {
    const watch = watchLocalMidnight((day) => setToday(day));
    const sub = AppState.addEventListener("change", (status) => {
      if (status === "active") watch.sync();
    });
    return () => {
      watch.stop();
      sub.remove();
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
    <View accessibilityRole="timer" accessibilityLabel={label}>
      <T role="body" color="textMuted">
        {label}
      </T>
    </View>
  );
}
