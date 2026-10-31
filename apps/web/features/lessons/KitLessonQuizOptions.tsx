"use client";

import { Icon } from "@/components/ui/Icon";
import type { LessonStep } from "./types";

/** Muse `cs-list` / `cs-option` quiz row for board+quiz lesson steps (05d). */
export function KitLessonQuizOptions({
  step,
  phase,
  pickedIndex = null,
  onPick,
}: {
  step: LessonStep;
  phase: "playing" | "correct" | "wrong";
  pickedIndex?: number | null;
  onPick?: (index: number) => void;
}) {
  const options = step.options ?? [];
  const correctIdx =
    step.correct ??
    options.findIndex((o) => step.solution?.includes(o.label)) ??
    0;
  const label = step.question ?? "Choose an answer";

  return (
    <div
      className="cs-list"
      data-single
      role="radiogroup"
      aria-label={label}
    >
      {options.map((opt, i) => {
        const checked = pickedIndex === i;
        const isCorrect = i === correctIdx;
        const stateClass =
          phase === "correct" && isCorrect
            ? "is-correct"
            : phase === "wrong" && pickedIndex === i && !isCorrect
              ? "is-wrong"
              : "";
        return (
          <button
            key={opt.label}
            type="button"
            className={`cs-option ${stateClass}`.trim()}
            role="radio"
            aria-checked={checked}
            onClick={() => onPick?.(i)}
            disabled={phase !== "playing" || !onPick}
          >
            <span className="k">
              {opt.emoji ? (
                <span aria-hidden>{opt.emoji}</span>
              ) : (
                <Icon name="target" size={18} />
              )}
            </span>
            <span className="ot">
              {opt.label}
              {opt.subtitle ? <small>{opt.subtitle}</small> : null}
            </span>
            <span className="rd">
              <Icon name="check" size={14} />
            </span>
          </button>
        );
      })}
    </div>
  );
}
