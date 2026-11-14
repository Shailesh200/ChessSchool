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
import { Options } from "./Options";
import { Button } from "./ui";

function poseFor(s: RunnerState, step: Step | undefined): CodyAnimation {
  if (s.botThinking) return "thinking";
  if (s.gameOver?.kind === "checkmate") return s.gameOver.winner === "w" ? "celebrate" : "proud";
  if (s.feedback?.tone === "good") return "happy";
  if (s.feedback?.tone === "hint") return "oops";
  return step?.pose ?? "idle";
}

/** Split coach copy into lines that fit the bubble, so the board never moves. */
function wrapLines(text: string, width: number, font: string): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return [""];
  if (width < 24 || typeof document === "undefined") return [words.join(" ")];
  const ctx = document.createElement("canvas").getContext("2d");
  if (!ctx) return [words.join(" ")];
  ctx.font = font;
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

type Props = {
  steps: Step[];
  closeHref: string;
  closeLabel?: string;
  /** Called with the step the learner left on, before leaving. */
  onClose?: (step: number) => void;
  /** Called once when the last step is passed. */
  onFinished: (misses: number) => void;
  /** Called when a step is solved, with whether the learner missed on it first (practice uses it for review). */
  onStep?: (index: number, missed: boolean) => void;
  /** Speaks a line in the coach's voice (lessons pass it; it does nothing without a recording). */
  say?: (text: string) => void;
  done: React.ReactNode;
};

export function LessonPlayer({ steps, closeHref, closeLabel = copy.lesson.close, onClose, onFinished, onStep, say, done }: Props) {
  const { cue } = useApp();
  const router = useRouter();
  const [s, setS] = useState(() => startRunner(steps));
  // Mirrors `s` for event handlers and timers, so cues fire from one place.
  const ref = useRef(s);
  const stepMisses = useRef(0);
  // The coach reads each step as it opens, then the praise or hint after a move.
  const stepText = s.steps[s.index]?.body;
  useEffect(() => {
    if (stepText && s.status !== "finished") say?.(stepText);
    // Re-runs when `say` changes so a step opened before its clips loaded is still read.
  }, [s.index, say]); // eslint-disable-line react-hooks/exhaustive-deps
  const said = s.feedback?.text;
  useEffect(() => {
    if (said) say?.(said);
  }, [s.feedback]); // eslint-disable-line react-hooks/exhaustive-deps
  const headingRef = useRef<HTMLHeadingElement>(null);
  const bodyRef = useRef<HTMLParagraphElement>(null);
  const finished = useRef(false);
  const step = currentStep(s);
  const [lines, setLines] = useState<string[]>([""]);
  const [line, setLine] = useState(0);

  const act = (a: RunnerAction) => {
    const prev = ref.current;
    const next = runnerReduce(prev, a);
    if (next === prev) return;
    ref.current = next;
    setS(next);
    if (next.status === "ready" && prev.status === "working") onStep?.(next.index, next.misses > stepMisses.current);
    if (next.index !== prev.index) stepMisses.current = next.misses;
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

  const body = step?.body ?? "";
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    const measure = () => {
      const style = getComputedStyle(el);
      const pad = (parseFloat(style.paddingLeft) || 0) + (parseFloat(style.paddingRight) || 0);
      const parent = el.parentElement?.clientWidth ?? el.clientWidth;
      setLines(wrapLines(body, Math.min(el.clientWidth, parent) - pad - 8, style.font));
    };
    measure();
    setLine(0);
    const obs = new ResizeObserver(measure);
    obs.observe(el);
    return () => obs.disconnect();
  }, [body, s.index]);

  useEffect(() => {
    if (line >= lines.length - 1) return;
    const words = lines[line]?.split(/\s+/).length ?? 1;
    const t = setTimeout(() => setLine((n) => Math.min(n + 1, lines.length - 1)), Math.min(2600, Math.max(800, words * 320)));
    return () => clearTimeout(t);
  }, [line, lines]);

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
  const spoken = lines[Math.min(line, Math.max(0, lines.length - 1))] || body;

  return (
    <div className="lesson">
      <header className="flow-top">
        <button
          className="icon-btn"
          onClick={() => {
            onClose?.(s.index);
            router.push(closeHref);
          }}
          aria-label={closeLabel}
        >
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
          stable
          top={
            <>
              <Cody animation={poseFor(s, step)} size={56} />
              <div className="bubble">
                <h1 ref={headingRef} tabIndex={-1}>
                  {step.title}
                </h1>
                <p ref={bodyRef} aria-live="polite">
                  {spoken}
                </p>
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
          {step.kind === "choice" ? <Options label={step.body} options={step.options} selected={s.choice} disabled={s.status === "ready"} onChoose={(index) => act({ type: "choose", index })} /> : null}

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
