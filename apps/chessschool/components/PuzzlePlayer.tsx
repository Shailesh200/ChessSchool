import { armPuzzleBeat, positionCue, puzzleHint, puzzleReduce, startPuzzle, type Puzzle, type PuzzleAction, type PuzzleBeat } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, View } from "react-native";
import { useApp } from "@/lib/state";
import { fonts, useTheme } from "@/lib/theme";
import { Board } from "./Board";
import { BoardStage } from "./BoardStage";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button, T } from "./ui";

type Props = {
  puzzle: Puzzle;
  onResult: (solved: boolean) => void;
  sprint?: boolean;
  top?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PuzzlePlayer({ puzzle, onResult, sprint, top, actions }: Props) {
  const { cue } = useApp();
  const { c } = useTheme();
  const [s, setS] = useState(() => startPuzzle(puzzle));
  const ref = useRef(s);
  const reported = useRef(false);
  const beat = useRef<PuzzleBeat | null>(null);
  const [misses, setMisses] = useState(0);

  const act = (a: PuzzleAction) => {
    const prev = ref.current;
    const next = puzzleReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setS(next);
    if (next.status === "failed" && prev.status !== "failed") {
      cue("gentle-no");
      setMisses((m) => m + 1);
      AccessibilityInfo.announceForAccessibility(copy.puzzles.wrong);
    } else if (next.status === "solved" && prev.status !== "solved") {
      cue("success");
      AccessibilityInfo.announceForAccessibility(copy.puzzles.solved);
    } else if (next.fen !== prev.fen) cue(positionCue(prev.fen, next.fen, next.lastMove));
    if (!reported.current && (next.status === "solved" || next.status === "failed")) {
      reported.current = true;
      onResult(next.status === "solved" && !next.missed);
    }
  };

  useEffect(() => {
    beat.current = armPuzzleBeat(s.status, s.step, beat.current, () => {
      const cur = ref.current;
      if (cur.status !== "setup" && cur.status !== "reply") return;
      act({ type: cur.status === "setup" ? "setup" : "reply" });
    });
    // act reads the latest state through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.status, s.step]);
  useEffect(() => () => beat.current?.cancel(), []);

  const side = copy.play.sides[s.you];
  const text = s.status === "solved" ? copy.puzzles.solved : s.status === "failed" ? copy.puzzles.wrong : s.step > 1 ? copy.puzzles.correct : copy.puzzles.yourMove(side);
  const tone = s.status === "solved" ? c.successText : s.status === "failed" ? c.goldText : c.text;

  return (
    <>
      <BoardStage
        top={
          top ?? (
            <>
              <Cody animation={s.status === "solved" ? "happy" : s.status === "failed" ? "oops" : "thinking"} size={48} />
              <T role="label" style={{ flex: 1 }}>
                {copy.puzzles.title}
              </T>
              <View accessibilityLabel={`${copy.puzzles.rating} ${puzzle.rating}`} style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 999, backgroundColor: c.goldSoft }}>
                <T role="label" style={{ color: c.goldText, fontFamily: fonts.bold }}>
                  {String(puzzle.rating)}
                </T>
              </View>
            </>
          )
        }
        bottom={
          <View accessibilityLiveRegion="polite" style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <T role="label" style={{ flex: 1, color: tone }}>
              {text}
            </T>
            {s.status === "solved" ? <Icon name="check" color={c.successText} /> : null}
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
            hints={puzzleHint(s)}
            onTap={(sq) => act({ type: "tap", square: sq })}
            disabled={s.status !== "solving"}
            shake={misses}
            promotion={s.promotion}
            onPromote={(p) => act(p ? { type: "promote", piece: p } : { type: "cancelPromotion" })}
          />
        )}
      </BoardStage>
      <View style={{ gap: 6, paddingBottom: 12 }}>
        {!sprint && s.status === "solving" && !s.hint ? <Button title={copy.puzzles.hint} icon="bulb" variant="ghost" onPress={() => act({ type: "hint" })} /> : null}
        {!sprint && s.status === "failed" ? (
          <View style={{ flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1 }}>
              <Button title={copy.puzzles.retry} icon="refresh" variant="secondary" onPress={() => act({ type: "retry" })} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={copy.puzzles.solution} icon="eye" variant="ghost" onPress={() => act({ type: "solution" })} />
            </View>
          </View>
        ) : null}
        {s.status === "solved" || s.status === "failed" ? actions : null}
      </View>
    </>
  );
}
