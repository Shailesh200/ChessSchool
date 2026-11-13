import { nextPuzzle, type Puzzle } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Cody } from "@/components/Lottie";
import { PuzzlePlayer } from "@/components/PuzzlePlayer";
import { Button, Flow, T, TopBar } from "@/components/ui";
import { usePuzzlePackReady } from "@/lib/puzzlePack";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";

const SECONDS = 180;
const LIVES = 3;

/** Puzzle sprint: 3 minutes, 3 mistakes, puzzles get harder as you go. */
export default function Sprint() {
  const ready = usePuzzlePackReady();
  const { c } = useTheme();
  if (!ready) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }
  return <SprintBody />;
}

function SprintBody() {
  const { state, finishSprint, cue } = useApp();
  const { c } = useTheme();
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
      <Flow top={<TopBar />} footer={<Button title={finished ? copy.puzzles.sprintAgain : copy.puzzles.sprint} icon="bolt" onPress={start} />}>
        <Cody animation={finished ? "celebrate" : "wow"} size={150} label={copy.a11y.mascot} />
        <T role="title" header center>
          {finished ? copy.puzzles.sprintOver : copy.puzzles.sprint}
        </T>
        <T role="bodyLg" color="textMuted" center>
          {finished ? copy.puzzles.sprintScore(score) : copy.puzzles.sprintBody}
        </T>
        {finished && score >= best && score > 0 ? (
          <T role="label" color="brandText">
            {copy.puzzles.newBest}
          </T>
        ) : null}
        <T role="small" color="textMuted">
          {copy.puzzles.sprintBest(Math.max(best, finished ? score : 0))}
        </T>
      </Flow>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={copy.puzzles.sprint} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>
        <PuzzlePlayer
          key={`${run}-${puzzle.id}`}
          puzzle={puzzle}
          sprint
          top={
            <>
              <View accessibilityRole="timer" style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: left < 20 ? c.danger : c.brand }}>
                <T role="label" style={{ color: c.onBrand, fontFamily: fonts.bold }}>
                  {copy.puzzles.timeLeft(left)}
                </T>
              </View>
              <T role="label" style={{ flex: 1 }}>
                {copy.puzzles.sprintScore(score)}
              </T>
              <T role="small" color="textMuted">
                {copy.puzzles.sprintLives(lives)}
              </T>
            </>
          }
          onResult={(solved) => {
            const nextScore = solved ? score + 1 : score;
            if (solved) setScore(nextScore);
            else setLives((l) => l - 1);
            setTimeout(() => pickNext(nextScore), solved ? 500 : 900);
          }}
        />
      </View>
    </SafeAreaView>
  );
}
