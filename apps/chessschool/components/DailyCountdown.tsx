import { dailyPuzzle, puzzleById, themesForCompletedLessons, type Puzzle } from "@chessschool/chess";
import { copy, dailyDone, dayKey, formatDailyCountdown, msUntilLocalMidnight } from "@chessschool/design";
import { useEffect, useState } from "react";
import { View } from "react-native";
import { T } from "@/components/ui";
import { useApp } from "@/lib/state";

/** Today's puzzle. Passing `serve` records it so the same id is not offered again. */
export function useDailyPuzzle(serve = true): { today: string; puzzle: Puzzle; done: boolean } {
  const { state, serveDailyPuzzle } = useApp();
  const today = dayKey(new Date());
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
    <View accessibilityRole="timer" accessibilityLabel={label}>
      <T role="body" color="textMuted">
        {label}
      </T>
    </View>
  );
}
