"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChessBoard } from "@/features/board/ChessBoard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import {
  analyzeMate,
  lastMoveFrames,
  matePreventionTip,
  type Frame,
} from "@/features/review/replay";
import type { BoardArrow, Square } from "@/core/types/chess";
import { audio } from "@/core/audio/audioEngine";

/** Step-through review of the last moves leading to checkmate. */
export function MatchMateReviewModal({
  open,
  pgn,
  orientation,
  onClose,
}: {
  open: boolean;
  pgn: string;
  orientation: "white" | "black";
  onClose: () => void;
}) {
  const steps = useMemo(() => (open ? lastMoveFrames(pgn, 5) : []), [open, pgn]);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (open) setIdx(0);
  }, [open, pgn]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, i - 1));
      if (e.key === "ArrowRight") setIdx((i) => Math.min(steps.length - 1, i + 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, steps.length]);

  const frame: Frame | undefined = steps[idx];
  const mate = useMemo(() => (frame?.mate ? analyzeMate(frame.fen) : null), [frame]);

  const arrows: BoardArrow[] = useMemo(() => {
    if (!mate) return [];
    return mate.attackers.map((a) => ({
      startSquare: a,
      endSquare: mate.kingSquare,
      color: "#f43f5e",
    }));
  }, [mate]);

  const highlight: Square[] = mate ? mate.covered.map((c) => c.square) : [];
  const atEnd = idx >= steps.length - 1;

  function go(delta: number) {
    setIdx((i) => {
      const n = i + delta;
      if (n >= 0 && n < steps.length) audio.play("move");
      return Math.max(0, Math.min(steps.length - 1, n));
    });
  }

  return (
    <AnimatePresence>
      {open && frame && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-end justify-center sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <button
            type="button"
            aria-label="Close review"
            className="bg-ink/50 absolute inset-0 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Checkmate review"
            initial={{ y: 40, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            className="border-hairline bg-surface-card relative max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-3xl border p-5 sm:rounded-3xl sm:[box-shadow:var(--shadow-pop)] lg:max-w-2xl"
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-ink text-lg font-extrabold lg:text-xl">
                  How the checkmate happened
                </h2>
                <p className="text-ink-500 text-xs font-semibold">
                  Step {idx + 1} of {steps.length} — last {steps.length}{" "}
                  {steps.length === 1 ? "move" : "moves"}
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

            <div className="mx-auto w-full max-w-[320px]">
              <ChessBoard
                fen={frame.fen}
                orientation={orientation}
                interactive={false}
                showNotation
                lastMove={
                  frame.from && frame.to ? { from: frame.from, to: frame.to } : null
                }
                arrows={arrows}
                highlight={highlight}
                checkSquare={mate ? mate.kingSquare : null}
              />
            </div>

            <p className="text-ink mt-3 text-center text-sm font-extrabold">
              {moveLabel(frame, idx, steps.length)}
            </p>

            <div className="mt-3 flex items-center justify-center gap-2">
              <StepBtn
                label="Previous move"
                disabled={idx === 0}
                onClick={() => go(-1)}
              >
                <Icon name="undo" size={18} />
              </StepBtn>
              <div className="flex gap-1">
                {steps.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Go to step ${i + 1}`}
                    onClick={() => {
                      audio.play("move");
                      setIdx(i);
                    }}
                    className={`h-2 w-2 rounded-full transition-colors ${
                      i === idx ? "bg-brand scale-125" : "bg-surface-sunken"
                    }`}
                  />
                ))}
              </div>
              <StepBtn label="Next move" disabled={atEnd} onClick={() => go(1)}>
                <Icon name="chevronRight" size={18} />
              </StepBtn>
            </div>

            <div className="mt-2 flex flex-wrap justify-center gap-1.5">
              {steps.map((f, i) => (
                <button
                  key={f.ply}
                  type="button"
                  onClick={() => {
                    audio.play("move");
                    setIdx(i);
                  }}
                  className={`rounded-md px-2 py-1 text-xs font-bold ${
                    idx === i ? "bg-brand text-white" : "bg-surface-sunken text-ink-700"
                  }`}
                >
                  {f.san}
                  {f.mate ? "#" : f.check ? "+" : ""}
                </button>
              ))}
            </div>

            {mate && atEnd && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-4"
              >
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
              </motion.div>
            )}

            <Button block className="mt-4" onClick={onClose}>
              {atEnd ? "Continue" : "Skip to result"}
            </Button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function moveLabel(frame: Frame, idx: number, total: number): string {
  if (!frame.san) return "Starting position";
  const num = Math.ceil(frame.ply / 2);
  const suffix = frame.mate ? " #" : frame.check ? " +" : "";
  if (idx === 0 && total > 1) {
    return `The attack begins: ${num}. ${frame.san}${suffix}`;
  }
  if (frame.mate) return `Checkmate — ${num}. ${frame.san}#`;
  return `${num}. ${frame.san}${suffix}`;
}

function StepBtn({
  children,
  label,
  disabled,
  onClick,
}: {
  children: React.ReactNode;
  label: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="btn-tactile border-hairline bg-surface-card flex h-10 w-10 items-center justify-center rounded-full border disabled:opacity-40"
    >
      {children}
    </button>
  );
}
