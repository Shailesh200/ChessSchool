"use client";

import { puzzleHint, puzzleReduce, startPuzzle, type Puzzle, type PuzzleAction } from "@chessschool/chess";
import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { Board } from "./Board";
import { BoardStage } from "./BoardStage";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button } from "./ui";

type Props = {
  puzzle: Puzzle;
  /** Called once per puzzle with the first-attempt result. */
  onResult: (solved: boolean) => void;
  /** Sprint mode: no retry/answer, move straight on. */
  sprint?: boolean;
  top?: React.ReactNode;
  actions?: React.ReactNode;
};

export function PuzzlePlayer({ puzzle, onResult, sprint, top, actions }: Props) {
  const { cue } = useApp();
  const [s, setS] = useState(() => startPuzzle(puzzle));
  const ref = useRef(s);
  const reported = useRef(false);
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
    } else if (next.status === "solved" && prev.status !== "solved") cue("success");
    else if (next.fen !== prev.fen) cue("tap");
    if (!reported.current && (next.status === "solved" || next.status === "failed")) {
      reported.current = true;
      onResult(next.status === "solved" && !next.missed);
    }
  };

  // The opponent's first move and every reply play after a short beat.
  useEffect(() => {
    if (s.status !== "setup" && s.status !== "reply") return;
    const t = setTimeout(() => act({ type: s.status === "setup" ? "setup" : "reply" }), s.status === "setup" ? 600 : 420);
    return () => clearTimeout(t);
    // act reads the latest state through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.status, s.step]);

  const side = copy.play.sides[s.you];
  const text = s.status === "solved" ? copy.puzzles.solved : s.status === "failed" ? copy.puzzles.wrong : s.step > 1 ? copy.puzzles.correct : copy.puzzles.yourMove(side);

  return (
    <>
      <span hidden data-puzzle={puzzle.id} data-status={s.status} />
      <BoardStage
        className="play-stage"
        top={
          top ?? (
            <div className="player">
              <Cody animation={s.status === "solved" ? "happy" : s.status === "failed" ? "oops" : "thinking"} size={48} />
              <p className="stage-status">{copy.puzzles.title}</p>
              <span className="chip chip-gold" aria-label={`${copy.puzzles.rating} ${puzzle.rating}`}>
                {puzzle.rating}
              </span>
            </div>
          )
        }
        bottom={
          <div className="player">
            <p className={`stage-status${s.status === "solved" ? " good" : s.status === "failed" ? " hint" : ""}`} role="status" aria-live="polite" key={`${misses}-${s.status}`}>
              {text}
            </p>
            {s.status === "solved" ? <Icon name="check" /> : null}
          </div>
        }
      >
        <Board fen={s.fen} orientation={s.you} selected={s.selected} targets={s.targets} lastMove={s.lastMove} check={s.check} hints={puzzleHint(s)} onTap={(sq) => act({ type: "tap", square: sq })} disabled={s.status !== "solving"} shake={misses} />
      </BoardStage>
      <div className="lesson-actions">
        {!sprint && s.status === "solving" && !s.hint ? (
          <Button block variant="ghost" icon="bulb" onClick={() => act({ type: "hint" })}>
            {copy.puzzles.hint}
          </Button>
        ) : null}
        {!sprint && s.status === "failed" ? (
          <>
            <Button block variant="secondary" icon="refresh" onClick={() => act({ type: "retry" })}>
              {copy.puzzles.retry}
            </Button>
            <Button block variant="ghost" icon="eye" onClick={() => act({ type: "solution" })}>
              {copy.puzzles.solution}
            </Button>
          </>
        ) : null}
        {s.status === "solved" || s.status === "failed" ? actions : null}
      </div>
    </>
  );
}
