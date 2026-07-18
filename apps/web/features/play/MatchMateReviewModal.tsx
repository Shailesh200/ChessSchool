"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  analyzeMate,
  lastMoveFrames,
  lastMoveFramesFromHistory,
  matePreventionTip,
  type Frame,
} from "@/features/review/replay";
import type { BoardArrow, Square } from "@/core/types/chess";
import { audio } from "@/core/audio/audioEngine";

/** Dwell on each position before advancing (no piece-slide animations). */
const STEP_MS = 900;
/** Hold the opening frame before the first advance. */
const INITIAL_MS = 700;
/** Hold the mate frame before looping back to the start. */
const LOOP_HOLD_MS = 2600;

const EMPTY_ARROWS: BoardArrow[] = [];
const EMPTY_HIGHLIGHT: Square[] = [];

type HistoryMove = {
  from: Square;
  to: Square;
  san: string;
  promotion?: string;
  captured?: string;
};

/** Auto-playing review of the last moves leading to checkmate. */
export function MatchMateReviewModal({
  open,
  pgn,
  history,
  orientation,
  onClose,
}: {
  open: boolean;
  pgn: string;
  history?: HistoryMove[];
  orientation: "white" | "black";
  onClose: () => void;
}) {
  if (typeof document === "undefined" || !open) return null;

  const sessionKey = `${pgn}|${history?.length ?? 0}`;

  return createPortal(
    <MateReviewSession
      key={sessionKey}
      pgn={pgn}
      history={history}
      orientation={orientation}
      onClose={onClose}
    />,
    document.body,
  );
}

function MateReviewSession({
  pgn,
  history,
  orientation,
  onClose,
}: {
  pgn: string;
  history?: HistoryMove[];
  orientation: "white" | "black";
  onClose: () => void;
}) {
  const steps = useMemo(
    () =>
      history?.length ? lastMoveFramesFromHistory(history, 5) : lastMoveFrames(pgn, 5),
    [history, pgn],
  );

  const [idx, setIdx] = useState(0);
  const [showMateExtras, setShowMateExtras] = useState(false);

  const timerRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);
  const idxRef = useRef(0);
  const stepsRef = useRef(steps);
  stepsRef.current = steps;

  const safeIdx = steps.length ? Math.min(idx, steps.length - 1) : 0;
  const frame = steps[safeIdx];
  const atEnd = steps.length > 0 && safeIdx === steps.length - 1;

  const mate = useMemo(() => {
    const last = steps[steps.length - 1];
    return last?.mate ? analyzeMate(last.fen) : null;
  }, [steps]);

  const arrows = useMemo(() => {
    if (!showMateExtras || !mate) return EMPTY_ARROWS;
    return mate.attackers.map((a) => ({
      startSquare: a,
      endSquare: mate.kingSquare,
      color: "#f43f5e",
    }));
  }, [showMateExtras, mate]);

  const highlight = useMemo(() => {
    if (!showMateExtras || !mate) return EMPTY_HIGHLIGHT;
    return mate.covered.map((c) => c.square);
  }, [showMateExtras, mate]);

  const checkSquare = showMateExtras && mate ? mate.kingSquare : null;
  const lastMove = useMemo(() => {
    if (!(safeIdx > 0 && frame?.from && frame?.to)) return null;
    return { from: frame.from, to: frame.to };
  }, [safeIdx, frame?.from, frame?.to]);

  function clearTimer() {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  function schedule(fn: () => void, ms: number) {
    clearTimer();
    timerRef.current = window.setTimeout(fn, ms);
  }

  const restartLoopRef = useRef<() => void>(() => {});
  const advanceRef = useRef<() => void>(() => {});

  restartLoopRef.current = () => {
    if (cancelledRef.current) return;
    setShowMateExtras(false);
    idxRef.current = 0;
    setIdx(0);
    schedule(() => advanceRef.current(), INITIAL_MS);
  };

  advanceRef.current = () => {
    if (cancelledRef.current) return;
    const list = stepsRef.current;
    if (list.length <= 1) return;

    const current = idxRef.current;
    if (current >= list.length - 1) {
      setShowMateExtras(true);
      schedule(() => restartLoopRef.current(), LOOP_HOLD_MS);
      return;
    }

    const next = current + 1;
    idxRef.current = next;
    if (list[next]?.san) audio.play("move");
    setIdx(next);

    if (next >= list.length - 1) {
      setShowMateExtras(Boolean(list[next]?.mate));
      schedule(() => restartLoopRef.current(), LOOP_HOLD_MS);
    } else {
      schedule(() => advanceRef.current(), STEP_MS);
    }
  };

  useEffect(() => {
    cancelledRef.current = false;
    clearTimer();
    idxRef.current = 0;
    setIdx(0);
    setShowMateExtras(false);

    if (steps.length === 0) {
      return () => {
        cancelledRef.current = true;
        clearTimer();
      };
    }

    if (steps.length === 1) {
      setShowMateExtras(Boolean(steps[0]?.mate));
      return () => {
        cancelledRef.current = true;
        clearTimer();
      };
    }

    schedule(() => advanceRef.current(), INITIAL_MS);

    return () => {
      cancelledRef.current = true;
      clearTimer();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- restart only when step frames change
  }, [steps]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function skipToMate() {
    if (steps.length === 0) return;
    clearTimer();
    const end = steps.length - 1;
    idxRef.current = end;
    setIdx(end);
    setShowMateExtras(Boolean(steps[end]?.mate));
    schedule(() => restartLoopRef.current(), LOOP_HOLD_MS);
  }

  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close review"
        className="bg-ink/40 absolute inset-0"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Checkmate review"
        className="border-hairline bg-surface-card relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-3xl sm:[box-shadow:var(--shadow-pop)] lg:max-w-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-ink text-lg font-extrabold lg:text-xl">
              How the checkmate happened
            </h2>
            <p className="text-ink-500 text-xs font-semibold">
              {atEnd && showMateExtras
                ? `Checkmate — looping · step ${safeIdx + 1} of ${steps.length}`
                : `Replaying — step ${safeIdx + 1} of ${steps.length} · loops`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="btn-tactile border-hairline bg-surface-sunken text-ink-700 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border"
          >
            <Icon name="close" size={18} />
          </button>
        </div>

        <div className="mx-auto aspect-square w-full max-w-[320px]">
          <ChessBoard
            boardId="mate-review-board"
            fen={frame.fen}
            orientation={orientation}
            interactive={false}
            showNotation
            showAnimations={false}
            lastMove={lastMove}
            arrows={arrows}
            highlight={highlight}
            checkSquare={checkSquare}
          />
        </div>

        <p className="text-ink mt-3 min-h-[1.25rem] text-center text-sm font-extrabold">
          {moveLabel(frame, safeIdx, steps.length)}
        </p>

        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full ${
                i === safeIdx
                  ? "bg-brand scale-125"
                  : i < safeIdx
                    ? "bg-brand/40"
                    : "bg-surface-sunken"
              }`}
            />
          ))}
        </div>

        <div className="mt-2 flex min-h-[2rem] flex-wrap justify-center gap-1.5">
          {steps.map((f, i) => (
            <span
              key={f.ply}
              className={`rounded-md px-2 py-1 text-xs font-bold ${
                safeIdx === i ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"
              }`}
            >
              {f.san ?? "…"}
              {f.mate ? "#" : f.check ? "+" : ""}
            </span>
          ))}
        </div>

        <div className="mt-4 min-h-[9.5rem]">
          {mate ? (
            <Card
              className={`border-danger/40 bg-danger/5 ${
                showMateExtras ? "opacity-100" : "pointer-events-none opacity-0"
              }`}
              aria-hidden={!showMateExtras}
            >
              <p className="text-danger text-sm font-extrabold">The mating net</p>
              <ul className="text-ink-700 mt-2 space-y-1 text-xs font-semibold">
                <li>
                  King on <b>{mate.kingSquare}</b> is in check with no legal move.
                </li>
                <li>
                  Check from <b>{mate.attackers.join(", ")}</b> (red arrows on the
                  board).
                </li>
                <li>Every escape square is blocked or attacked (highlighted).</li>
              </ul>
              <p className="bg-surface-sunken text-ink mt-2 rounded-lg px-3 py-2 text-xs font-bold">
                {matePreventionTip(mate.pattern)}
              </p>
            </Card>
          ) : null}
        </div>

        <div className="mt-4 flex flex-col gap-2">
          <Button
            block
            variant="outline"
            onClick={skipToMate}
            disabled={atEnd && showMateExtras}
          >
            Skip to checkmate
          </Button>
          <Button block onClick={onClose}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}

function moveLabel(frame: Frame, idx: number, total: number): string {
  if (!frame.san) {
    return idx === 0 && total > 1 ? "Before the final attack" : "Starting position";
  }
  const num = Math.ceil(frame.ply / 2);
  const suffix = frame.mate ? " #" : frame.check ? " +" : "";
  if (frame.mate) return `Checkmate — ${num}. ${frame.san}#`;
  return `${num}. ${frame.san}${suffix}`;
}
