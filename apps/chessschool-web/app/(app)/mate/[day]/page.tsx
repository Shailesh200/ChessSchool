"use client";

import { armPuzzleBeat, puzzleReduce, startPuzzle, type PuzzleAction, type PuzzleBeat } from "@chessschool/chess";
import { copy, MATE_TRIES, mateGrid, mateShareText, recordMateTry, withCelebrations, type MateResponse } from "@chessschool/design";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Board } from "@/components/Board";
import { BoardStage } from "@/components/BoardStage";
import { Cody } from "@/components/Lottie";
import { Button, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";

type Tries = boolean[][];

/** One try at the mate: each of the learner's two moves is right or wrong; a wrong one ends the try. */
function MateBoard({ puzzle, onTry }: { puzzle: MateResponse["puzzle"]; onTry: (moves: boolean[]) => void }) {
  const { cue } = useApp();
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
      cue(next.status === "failed" ? "gentle-no" : next.status === "solved" ? "success" : "tap");
      if (next.status === "failed" || next.status === "solved") onTry(moves.current);
    }
  };
  useEffect(() => {
    beat.current = armPuzzleBeat(s.status, s.step, beat.current, () => {
      const cur = ref.current;
      if (cur.status === "setup" || cur.status === "reply") act({ type: cur.status });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.status, s.step]);
  useEffect(() => () => beat.current?.cancel(), []);
  return (
    <BoardStage
      className="play-stage"
      top={
        <div className="player">
          <Cody animation={s.status === "solved" ? "correct" : s.status === "failed" ? "wrong" : "thinking"} size={48} />
          <p className="player-name">{copy.mate.yourMove}</p>
        </div>
      }
      bottom={
        <p className={`stage-status${s.status === "solved" ? " good" : s.status === "failed" ? " hint" : ""}`} role="status" aria-live="polite">
          {s.status === "solved" ? copy.puzzles.solved : s.status === "failed" ? copy.puzzles.wrong : s.step > 1 ? copy.puzzles.correct : copy.puzzles.yourMove(copy.play.sides[s.you])}
        </p>
      }
    >
      <Board
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
    </BoardStage>
  );
}

export default function MatePage() {
  const { day } = useParams<{ day: string }>();
  const { state, ready, update, cue } = useApp();
  const toast = useToast();
  const [data, setData] = useState<MateResponse | "missing" | "offline" | null>(null);
  const [localTries, setLocalTries] = useState<Tries>([]);
  const [round, setRound] = useState(0);
  const [missed, setMissed] = useState(false);
  const [solvedCount, setSolvedCount] = useState<number | null>(null);

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
  const top = <TopBar title={t.title} backHref="/today" />;
  if (!ready || !data) return <div className="page page-narrow">{top}<p className="muted" aria-busy="true">{t.loading}</p></div>;
  if (data === "missing" || data === "offline") return <div className="page page-narrow">{top}<p className="muted">{data === "missing" ? t.notFound : t.offline}</p></div>;

  // Today's mate is kept with the learner's day; an older shared one is just played here.
  const isToday = data.day === data.today;
  const mine = isToday && state.habit.mate?.day === data.day ? state.habit.mate : null;
  const tries: Tries = isToday ? (mine?.tries ?? []) : localTries;
  const solved = tries.some((r) => r.length === 2 && r.every(Boolean));
  const done = solved || tries.length >= MATE_TRIES;
  const result = solved ? t.solvedIn(tries.length) : t.failed;

  const onTry = (moves: boolean[]) => {
    const row = moves.slice(0, 2);
    const next = [...tries, row];
    const nowSolved = row.length === 2 && row.every(Boolean);
    if (isToday) update((s) => withCelebrations(s, recordMateTry(s, data.day, row, new Date()), new Date()));
    else setLocalTries(next);
    setMissed(!nowSolved);
    if (nowSolved || next.length >= MATE_TRIES) {
      cue(nowSolved ? "level-up" : "stamp");
      api
        .mateDone(data.day, nowSolved)
        .then((c) => setSolvedCount(c.solved))
        .catch(() => {});
    }
  };

  const share = async () => {
    const text = mateShareText(data.day, tries, t.shareTitle(data.day), result);
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        toast(t.copied);
      }
    } catch {}
  };

  return (
    <div className="page page-narrow mate-page">
      {top}
      {done ? (
        <section className="mate-result" aria-live="polite">
          <h2 className="card-title">{result}</h2>
          <pre className="mate-grid" aria-hidden>
            {mateGrid(tries)}
          </pre>
          {solvedCount ? <p className="muted">{t.solvedToday(solvedCount)}</p> : null}
          <div className="flow-actions">
            <Button block icon="sparkles" onClick={share}>
              {t.share}
            </Button>
            <Button block variant="secondary" href="/today" icon="learn">
              {state.account || state.progress.completed.meet ? copy.lesson.back : t.getApp}
            </Button>
          </div>
        </section>
      ) : (
        <>
          <MateBoard key={`${data.day}-${round}`} puzzle={data.puzzle} onTry={onTry} />
          <div className="lesson-actions play-panel">
            <p className="muted">{t.triesLeft(MATE_TRIES - tries.length)}</p>
            {missed ? (
              <Button
                block
                variant="secondary"
                icon="refresh"
                onClick={() => {
                  setMissed(false);
                  setRound((n) => n + 1);
                }}
              >
                {t.tryAgain}
              </Button>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
