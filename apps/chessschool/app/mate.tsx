import { armPuzzleBeat, positionCue, puzzleReduce, startPuzzle, type PuzzleAction, type PuzzleBeat } from "@chessschool/chess";
import { copy, indiaDay, MATE_TRIES, mateGrid, mateShareText, recordMateTry, withCelebrations, type MateResponse } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Share, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { Cody } from "@/components/Lottie";
import { Button, T, TopBar } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { useTheme } from "@/lib/theme";

/** One try at the mate: each of the learner's two moves is right or wrong; a wrong one ends the try. */
function MateBoard({ puzzle, onTry }: { puzzle: MateResponse["puzzle"]; onTry: (moves: boolean[]) => void }) {
  const { cue } = useApp();
  const { c } = useTheme();
  const [s, setS] = useState(() => startPuzzle({ ...puzzle, rating: 0, themes: ["mateIn2"] }));
  const ref = useRef(s);
  const moves = useRef<boolean[]>([]);
  const beat = useRef<PuzzleBeat | null>(null);
  const act = (a: PuzzleAction) => {
    const prev = ref.current;
    const next = puzzleReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setS(next);
    if (prev.status === "solving" && next.status !== "solving") {
      moves.current.push(next.status !== "failed");
      cue(next.status === "failed" ? "gentle-no" : next.status === "solved" ? "success" : positionCue(prev.fen, next.fen, next.lastMove));
      if (next.status === "failed" || next.status === "solved") onTry(moves.current);
    } else if (next.fen !== prev.fen) cue(positionCue(prev.fen, next.fen, next.lastMove));
  };
  useEffect(() => {
    beat.current = armPuzzleBeat(s.status, s.step, beat.current, () => {
      const cur = ref.current;
      if (cur.status === "setup" || cur.status === "reply") act({ type: cur.status });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.status, s.step]);
  useEffect(() => () => beat.current?.cancel(), []);
  const text = s.status === "solved" ? copy.puzzles.solved : s.status === "failed" ? copy.puzzles.wrong : s.step > 1 ? copy.puzzles.correct : copy.puzzles.yourMove(copy.play.sides[s.you]);
  return (
    <BoardStage
      top={
        <>
          <Cody animation={s.status === "solved" ? "correct" : s.status === "failed" ? "wrong" : "thinking"} size={48} />
          <T role="label" style={{ flex: 1 }}>
            {copy.mate.yourMove}
          </T>
        </>
      }
      bottom={
        <View accessibilityLiveRegion="polite" style={{ flex: 1, justifyContent: "center" }}>
          <T role="label" style={{ color: s.status === "solved" ? c.successText : s.status === "failed" ? c.goldText : c.text }}>
            {text}
          </T>
        </View>
      }
    >
      {(size, radius) => (
        <Board
          size={size}
          radius={radius}
          fen={s.fen}
          orientation={s.you}
          selected={s.selected}
          targets={s.targets}
          lastMove={s.lastMove}
          check={s.check}
          onTap={(sq) => act({ type: "tap", square: sq })}
          disabled={s.status !== "solving"}
          promotion={s.promotion}
          onPromote={(p) => act(p ? { type: "promote", piece: p } : { type: "cancelPromotion" })}
        />
      )}
    </BoardStage>
  );
}

/** Mate of the day: the same mate in two for everyone today (India date), three tries, a shareable grid. */
export default function MateScreen() {
  const { state, update, cue } = useApp();
  const { c } = useTheme();
  const [data, setData] = useState<MateResponse | "missing" | "offline" | null>(null);
  const [round, setRound] = useState(0);
  const [missed, setMissed] = useState(false);
  const [solvedCount, setSolvedCount] = useState<number | null>(null);
  const day = indiaDay(Date.now());
  useEffect(() => {
    let live = true;
    api
      .mate(day)
      .then((r) => {
        if (!live) return;
        setData(r);
        setSolvedCount(r.solved);
      })
      .catch((err) => live && setData(Number(err?.status) === 404 ? "missing" : "offline"));
    return () => {
      live = false;
    };
  }, [day]);
  const t = copy.mate;
  const frame = (children: React.ReactNode) => (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingHorizontal: 12 }}>
        <TopBar title={t.title} />
      </View>
      <View style={{ flex: 1, paddingHorizontal: 12, gap: 10, maxWidth: 640, width: "100%", alignSelf: "center" }}>{children}</View>
    </SafeAreaView>
  );
  if (!data) return frame(<ActivityIndicator accessibilityLabel={t.loading} style={{ marginTop: 40 }} />);
  if (data === "missing" || data === "offline")
    return frame(
      <T role="body" color="textMuted" center>
        {data === "missing" ? t.notFound : t.offline}
      </T>,
    );

  const mine = state.habit.mate?.day === data.day ? state.habit.mate : null;
  const tries = mine?.tries ?? [];
  const done = Boolean(mine?.done);
  const result = mine?.solved ? t.solvedIn(tries.length) : t.failed;

  const onTry = (moves: boolean[]) => {
    const row = moves.slice(0, 2);
    const solved = row.length === 2 && row.every(Boolean);
    update((s) => withCelebrations(s, recordMateTry(s, data.day, row, new Date()), new Date()));
    setMissed(!solved);
    if (solved || tries.length + 1 >= MATE_TRIES) {
      cue(solved ? "level-up" : "stamp");
      api
        .mateDone(data.day, solved)
        .then((r) => setSolvedCount(r.solved))
        .catch(() => {});
    }
  };

  if (done)
    return frame(
      <View style={{ alignItems: "center", gap: 14, paddingTop: 24 }} accessibilityLiveRegion="polite">
        <T role="title" header center>
          {result}
        </T>
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <T role="title" center>
            {mateGrid(tries)}
          </T>
        </View>
        {solvedCount ? (
          <T role="body" color="textMuted" center>
            {t.solvedToday(solvedCount)}
          </T>
        ) : null}
        <View style={{ alignSelf: "stretch", gap: 8 }}>
          <Button title={t.share} icon="sparkles" onPress={() => void Share.share({ message: mateShareText(data.day, tries, t.shareTitle(data.day), result) }).catch(() => {})} />
        </View>
      </View>,
    );

  return frame(
    <>
      <MateBoard key={`${data.day}-${round}`} puzzle={data.puzzle} onTry={onTry} />
      <View style={{ gap: 6, paddingBottom: 12 }}>
        <T role="small" color="textMuted" center>
          {t.triesLeft(MATE_TRIES - tries.length)}
        </T>
        {missed ? (
          <Button
            title={t.tryAgain}
            icon="refresh"
            variant="secondary"
            onPress={() => {
              setMissed(false);
              setRound((n) => n + 1);
            }}
          />
        ) : null}
      </View>
    </>,
  );
}
