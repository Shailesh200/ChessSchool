"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { LessonStep } from "./types";
import { formatCoachText } from "@chess-school/progression";
import { PreschoolQuizVisual } from "./PreschoolQuizVisual";
import { audio } from "@/core/audio/audioEngine";
import { haptics } from "@/core/haptics/haptics";

const LETTERS = "ABCDEF";

export function PreschoolQuiz({
  step,
  phase,
  onAnswer,
}: {
  step: LessonStep;
  phase: "playing" | "correct" | "wrong";
  onAnswer: (correct: boolean) => void;
}) {
  const [picked, setPicked] = useState<number | null>(null);
  const [shake, setShake] = useState(0);
  const options = step.options ?? [];
  const correctIdx = step.correct ?? 0;

  function pick(i: number) {
    if (phase === "correct" || picked !== null) return;
    setPicked(i);
    const ok = i === correctIdx;
    if (ok) {
      audio.play("success");
      haptics.fire("success");
    } else {
      audio.play("fail");
      haptics.fire("error");
      setShake((s) => s + 1);
      window.setTimeout(() => {
        setPicked(null);
        onAnswer(false);
      }, 900);
      return;
    }
    onAnswer(true);
  }

  return (
    <div className="flex w-full max-w-md flex-col gap-4">
      <PreschoolQuizVisual
        visual={step.visual}
        visualSquare={step.visualSquare}
        visualSquares={step.visualSquares}
      />

      {/* Question — own block, never inline with answers */}
      <motion.div
        key={step.question}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-hairline bg-surface-card px-4 py-3.5 [box-shadow:var(--shadow-card)]"
      >
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-brand">Question</p>
        <p className="text-base font-extrabold leading-snug text-ink">{step.question}</p>
      </motion.div>

      {/* Answers — start on the next line / section */}
      <div className="flex flex-col gap-2">
        <p className="text-[10px] font-extrabold uppercase tracking-widest text-ink-500">Choose your answer</p>
        <motion.div key={shake} animate={shake ? { x: [0, -8, 8, -6, 6, 0] } : {}} className="flex flex-col gap-2">
          {options.map((opt, i) => {
            const selected = picked === i;
            const isCorrect = i === correctIdx;
            const reveal = phase === "correct" && picked !== null;
            const tone =
              reveal && selected && isCorrect
                ? "border-success bg-success/10"
                : reveal && selected && !isCorrect
                  ? "border-capture bg-capture/10"
                  : reveal && isCorrect
                    ? "border-success/50 bg-success/5"
                    : selected
                      ? "border-brand bg-brand-50"
                      : "border-hairline bg-surface-card";

            return (
              <motion.button
                key={`${step.id}-${i}`}
                type="button"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                disabled={phase === "correct" || (picked !== null && picked !== i)}
                onClick={() => pick(i)}
                className={`btn-tactile w-full rounded-2xl border-2 px-4 py-3.5 text-left transition-colors ${tone}`}
              >
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-xs font-extrabold text-brand">
                      {LETTERS[i]}
                    </span>
                    {opt.emoji ? <span className="text-xl leading-none">{opt.emoji}</span> : null}
                    {reveal && isCorrect && <span className="ml-auto text-lg text-success">✓</span>}
                  </div>
                  <p className="pl-8 text-sm font-extrabold leading-snug text-ink">{opt.label}</p>
                </div>
              </motion.button>
            );
          })}
        </motion.div>
      </div>

      <AnimatePresence>
        {phase === "correct" && step.explain && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl border border-success/30 bg-success/10 px-4 py-3.5"
          >
            <p className="mb-1.5 text-[10px] font-extrabold uppercase tracking-widest text-success-600">Answer</p>
            <p className="whitespace-pre-wrap text-sm font-semibold leading-relaxed text-ink">
              {formatCoachText(step.explain)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
