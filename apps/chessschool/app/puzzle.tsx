import { dailyPuzzle, nextPuzzle, PUZZLE_THEMES, updateRating, type Puzzle, type PuzzleThemeId } from "@chessschool/chess";
import { copy, dayKey } from "@chessschool/design";
import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, T, TopBar } from "@/components/ui";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

export default function PuzzleScreen() {
  const params = useLocalSearchParams<{ theme?: string; daily?: string }>();
  const { state, finishPuzzle } = useApp();
  const { c } = useTheme();
  const daily = params.daily === "1";
  const theme = (PUZZLE_THEMES.find((t) => t.id === params.theme)?.id ?? null) as PuzzleThemeId | null;
  const [puzzle, setPuzzle] = useState<Puzzle>(() => (daily ? dailyPuzzle(dayKey(new Date())) : nextPuzzle({ rating: state.progress.puzzles.rating, theme, exclude: state.progress.puzzles.recent })));
  const [round, setRound] = useState(0);
  const [delta, setDelta] = useState<number | null>(null);
  const title = daily ? copy.puzzles.daily : theme ? PUZZLE_THEMES.find((t) => t.id === theme)!.name : copy.puzzles.play;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={title} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
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
                <T role="label" center style={{ color: delta >= 0 ? c.successText : c.dangerText }}>
                  {`${copy.puzzles.rating} ${state.progress.puzzles.rating} (${copy.puzzles.ratingChange(delta)})`}
                </T>
              ) : null}
              {daily ? (
                <Button title={copy.puzzles.back} icon="back" onPress={() => router.back()} />
              ) : (
                <Button
                  title={copy.puzzles.next}
                  icon="arrowRight"
                  onPress={() => {
                    setDelta(null);
                    setPuzzle(nextPuzzle({ rating: state.progress.puzzles.rating, theme, exclude: [puzzle.id, ...state.progress.puzzles.recent] }));
                    setRound((r) => r + 1);
                  }}
                />
              )}
            </>
          }
        />
      </View>
    </SafeAreaView>
  );
}
