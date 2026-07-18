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

/** Piece slide duration — keep in sync with ChessBoard animationDurationInMs. */
const ANIM_MS = 300;
/** Pause after each animated move before the next one starts. */
const PAUSE_MS = 700;
const STEP_MS = ANIM_MS + PAUSE_MS;
/** Hold the opening frame before the first move slides. */
const INITIAL_MS = PAUSE_MS;
/** Reserved height so the mating-net card doesn't shove the board when it appears. */
const MATE_CARD_SLOT = "min-h-[9.5rem]";

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
  const [overlayRevealed, setOverlayRevealed] = useState(false);
  const [skipAnim, setSkipAnim] = useState(false);
  const [boardReady, setBoardReady] = useState(false);
  const timerRef = useRef<number | null>(null);

  const safeIdx = steps.length ? Math.min(idx, steps.length - 1) : 0;
  const frame = steps[safeIdx];
  const atEnd = safeIdx >= steps.length - 1;
  const atMateEnd = atEnd && Boolean(frame?.mate);
  const showMateOverlay = atMateEnd && overlayRevealed;

  // Wait one frame after mount so the sheet isn't mid-opacity/composite when
  // react-chessboard starts sliding pieces (that combo flickers on WebKit).
  useEffect(() => {
    const id = window.requestAnimationFrame(() => setBoardReady(true));
    return () => window.cancelAnimationFrame(id);
  }, []);

  useEffect(() => {
    if (!boardReady) return;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (steps.length <= 1) return;

    let current = 0;
    let cancelled = false;

    const advance = () => {
      if (cancelled || current >= steps.length - 1) return;
      current += 1;
      if (steps[current]?.san) audio.play("move");
      setIdx(current);
      timerRef.current = window.setTimeout(advance, STEP_MS);
    };

    timerRef.current = window.setTimeout(advance, INITIAL_MS);

    return () => {
      cancelled = true;
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, [steps, boardReady]);

  useEffect(() => {
    if (!atMateEnd) return;
    const t = window.setTimeout(() => setOverlayRevealed(true), ANIM_MS + 180);
    return () => window.clearTimeout(t);
  }, [atMateEnd, safeIdx]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const mate = useMemo(
    () => (showMateOverlay && frame?.mate ? analyzeMate(frame.fen) : null),
    [showMateOverlay, frame],
  );

  const arrows: BoardArrow[] = useMemo(() => {
    if (!mate) return [];
    return mate.attackers.map((a) => ({
      startSquare: a,
      endSquare: mate.kingSquare,
      color: "#f43f5e",
    }));
  }, [mate]);

  const highlight: Square[] = mate ? mate.covered.map((c) => c.square) : [];

  function skipToEnd() {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    setSkipAnim(true);
    const end = Math.max(0, steps.length - 1);
    setIdx(end);
    if (steps[end]?.mate) setOverlayRevealed(true);
    // Keep snaps off for two frames so react-chessboard applies the jump
    // without a mid-flight slide, then re-enable for any later interactions.
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setSkipAnim(false));
    });
  }

  if (!frame) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center sm:p-6">
      <button
        type="button"
        aria-label="Close review"
        className="bg-ink/50 absolute inset-0 animate-fade-in backdrop-blur-sm"
        onClick={onClose}
      />
      {/* No opacity animation on the sheet — parent opacity + piece transforms flicker. */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Checkmate review"
        className="border-hairline bg-surface-card animate-sheet-up relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-3xl sm:[box-shadow:var(--shadow-pop)] lg:max-w-2xl"
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-ink text-lg font-extrabold lg:text-xl">
              How the checkmate happened
            </h2>
            <p className="text-ink-500 text-xs font-semibold">
              {atEnd
                ? `Final move — step ${safeIdx + 1} of ${steps.length}`
                : `Replaying — step ${safeIdx + 1} of ${steps.length}`}
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

        {/* Isolated compositor layer — never put this under an opacity tween. */}
        <div className="mx-auto w-full max-w-[320px] [transform:translateZ(0)]">
          {boardReady ? (
            <ChessBoard
              boardId="mate-review-board"
              fen={frame.fen}
              orientation={orientation}
              interactive={false}
              showNotation
              showAnimations={!skipAnim}
              animationDurationInMs={ANIM_MS}
              lastMove={
                safeIdx > 0 && frame.from && frame.to
                  ? { from: frame.from, to: frame.to }
                  : null
              }
              arrows={arrows}
              highlight={highlight}
              checkSquare={mate ? mate.kingSquare : null}
            />
          ) : (
            <div className="skeleton rounded-card aspect-square w-full" aria-hidden />
          )}
        </div>

        <p className="text-ink mt-3 text-center text-sm font-extrabold">
          {moveLabel(frame, safeIdx, steps.length)}
        </p>

        <div className="mt-3 flex items-center justify-center gap-1.5" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 w-2 rounded-full transition-colors ${
                i === safeIdx
                  ? "bg-brand scale-125"
                  : i < safeIdx
                    ? "bg-brand/40"
                    : "bg-surface-sunken"
              }`}
            />
          ))}
        </div>

        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
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

        <div className={`mt-4 ${MATE_CARD_SLOT}`}>
          {mate && showMateOverlay ? (
            <Card className="border-danger/40 bg-danger/5">
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

        <Button block className="mt-4" onClick={atEnd ? onClose : skipToEnd}>
          {atEnd ? "Continue" : "Skip to result"}
        </Button>
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
