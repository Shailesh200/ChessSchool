"use client";

import { chooseMove, currentStep, hintSquares, parseUci, runnerReduce, startRunner, type RunnerAction, type RunnerState, type Step } from "@chessschool/chess";
import { copy, type CodyAnimation } from "@chessschool/design";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useApp } from "@/lib/state";
import { Board } from "./Board";
import { BoardStage } from "./BoardStage";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";
import { Button } from "./ui";

function poseFor(s: RunnerState, step: Step | undefined): CodyAnimation {
  if (s.botThinking) return "thinking";
  if (s.gameOver?.kind === "checkmate") return s.gameOver.winner === "w" ? "celebrate" : "proud";
  if (s.feedback?.tone === "good") return "happy";
  if (s.feedback?.tone === "hint") return "oops";
  return step?.pose ?? "idle";
}

type Props = {
  steps: Step[];
  closeHref: string;
  closeLabel?: string;
  /** Called once when the last step is passed. */
  onFinished: (misses: number) => void;
  done: React.ReactNode;
};

export function LessonPlayer({ steps, closeHref, closeLabel = copy.lesson.close, onFinished, done }: Props) {
  const { cue } = useApp();
  const router = useRouter();
  const [s, setS] = useState(() => startRunner(steps));
  // Mirrors `s` for event handlers and timers, so cues fire from one place.
  const ref = useRef(s);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const finished = useRef(false);
  const step = currentStep(s);

  const act = (a: RunnerAction) => {
    const prev = ref.current;
    const next = runnerReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setS(next);
    if (next.misses > prev.misses) cue("gentle-no");
    else if (next.status === "ready" && prev.status !== "ready") cue("success");
    else if (next.fen !== prev.fen) cue("tap");
    if (next.status === "finished" && !finished.current) {
      finished.current = true;
      onFinished(next.misses);
    }
  };

  // Cody's reply in the game step, with a short human pause.
  useEffect(() => {
    if (!s.botThinking) return;
    const t = setTimeout(() => {
      // Line steps play their scripted reply; game steps ask Cody.
      const cur = ref.current;
      const scripted = step?.kind === "line" ? parseUci(step.moves[cur.lineStep] ?? "") : null;
      const m = scripted ?? chooseMove(cur.fen, step?.kind === "game" ? step.level : "cody");
      if (m) act({ type: "bot", move: { from: m.from as never, to: m.to as never } });
    }, 650);
    return () => clearTimeout(t);
    // act reads the latest state through the ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [s.botThinking, s.fen]);

  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [s.index, s.status === "finished"]);

  const total = steps.length;
  if (s.status === "finished") {
    return (
      <div className="lesson">
        <header className="flow-top">
          <span className="icon-btn-spacer" />
          <div className="steps" aria-hidden>
            {steps.map((_, i) => (
              <span key={i} className="on" />
            ))}
          </div>
          <span className="icon-btn-spacer" />
        </header>
        <div className="lesson-done">{done}</div>
      </div>
    );
  }
  if (!step) return null;

  const interactive = step.kind !== "say";
  const canEnd = step.kind === "game" && s.gameMoves >= step.minMoves && !s.botThinking && s.status === "working";
  const status =
    step.kind === "stars" && s.status === "working"
      ? copy.lesson.starsLeft(s.stars.length)
      : step.kind === "game" && s.status === "working"
        ? s.botThinking
          ? copy.lesson.thinking
          : copy.lesson.yourMove
        : null;

  return (
    <div className="lesson">
      <header className="flow-top">
        <button className="icon-btn" onClick={() => router.push(closeHref)} aria-label={closeLabel}>
          <Icon name="close" />
        </button>
        <div className="steps" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={s.index + 1} aria-label={copy.lesson.progress(s.index + 1, total)}>
          {steps.map((_, i) => (
            <span key={i} className={i <= s.index ? "on" : ""} />
          ))}
        </div>
        <span className="step-count">{copy.lesson.progress(s.index + 1, total)}</span>
        <span className="icon-btn-spacer" />
      </header>

      <div className="lesson-stage" data-kind={step.kind}>
        <BoardStage
          top={
            <>
              <Cody animation={poseFor(s, step)} size={64} />
              <div className="bubble">
                <h1 ref={headingRef} tabIndex={-1}>
                  {step.title}
                </h1>
                <p>{step.body}</p>
              </div>
            </>
          }
          bottom={
            <div className="player">
              <span className="player-avatar" aria-hidden>
                <Icon name="profile" size={22} />
              </span>
              <p className={`stage-status${s.feedback ? ` ${s.feedback.tone}` : ""}`} role="status" aria-live="polite" key={`${s.misses}-${s.status}`}>
                {s.feedback ? s.feedback.text : (status ?? (step.kind === "game" ? copy.lesson.endGameHint(step.minMoves) : ""))}
              </p>
              {s.feedback ? <Icon name={s.feedback.tone === "good" ? "check" : "bulb"} /> : null}
            </div>
          }
        >
          <Board
            fen={s.fen}
            selected={step.kind === "tap" ? (s.status === "ready" ? s.selected : null) : s.selected}
            targets={s.targets}
            lastMove={s.lastMove}
            check={s.check}
            promotion={s.promotion}
            onPromote={(p) => act(p ? { type: "promote", piece: p } : { type: "cancelPromotion" })}
            highlight={step.highlight}
            hints={hintSquares(s)}
            stars={s.stars}
            onTap={(sq) => act({ type: "tap", square: sq })}
            disabled={!interactive || step.kind === "choice" || s.status !== "working" || s.botThinking}
            shake={s.misses}
          />
        </BoardStage>

        <div className="lesson-panel">
          {step.kind === "choice" ? (
            <div className="choices" role="radiogroup" aria-label={step.body}>
              {step.options.map((o, i) => (
                <button key={o.label} type="button" role="radio" className="choice" aria-checked={s.choice === i} disabled={s.status === "ready"} onClick={() => act({ type: "choose", index: i })}>
                  {o.label}
                  {s.choice === i && s.status === "ready" ? <Icon name="check" /> : null}
                </button>
              ))}
            </div>
          ) : null}

          <div className="lesson-actions">
            {s.status === "ready" ? (
              <Button block onClick={() => act({ type: "next" })} icon="arrowRight">
                {copy.lesson.next}
              </Button>
            ) : canEnd ? (
              <Button block variant="secondary" onClick={() => act({ type: "endGame" })} icon="flag">
                {copy.lesson.endGame}
              </Button>
            ) : null}
            {interactive && step.kind !== "game" && s.status === "working" && !s.showHint ? (
              <Button block variant="ghost" icon="bulb" onClick={() => act({ type: "hint" })}>
                {copy.lesson.hint}
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
