"use client";

import { copy, type CodyAnimation } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Cody, Fx } from "./Lottie";

export type LessonSummary = { xp: number; accuracy: number; seconds: number; perfectBonus?: number; best: number };

/** The end-of-lesson moment: stamp, Cody, earned XP and streak, the lesson summary, then what's next. */
export function LessonDone({ title, body, recap, xp, streak, goalMet, hints, summary, children }: { title: string; body: string; recap?: string; xp?: number; streak?: number; goalMet?: boolean; hints?: number; summary?: LessonSummary; children: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  // Lesson finished, then (when today's streak or goal just landed) the streak-saved beat.
  const [pose, setPose] = useState<CodyAnimation>("lesson-complete");
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <>
      <div className="seal">
        <Fx name="stamp" size={180} className="seal-stamp" />
        <Cody animation={pose} onComplete={() => (streak || goalMet) && setPose("streak-saved")} size={150} className="seal-cody" label={copy.a11y.mascot} />
      </div>
      <div className="done-chips">
        {xp ? (
          <div className="xp-pill" role="img" aria-label={copy.a11y.xp(xp)}>
            <Fx name="xp-pop" size={40} />
            <span aria-hidden>{copy.orientation.xp(xp)}</span>
          </div>
        ) : null}
        {streak ? (
          <div className="streak-pill is-bold" role="img" aria-label={copy.lesson.streakUp(streak)}>
            <Fx name="streak-spark" size={40} />
            <span aria-hidden>{copy.lesson.streakUp(streak)}</span>
          </div>
        ) : null}
      </div>
      <h1 ref={headingRef} tabIndex={-1}>
        {title}
      </h1>
      <p className="lead">{body}</p>
      {summary ? (
        <section className="lesson-summary" aria-label={copy.lesson.summaryTitle}>
          <dl aria-label={copy.lesson.summaryA11y(summary.xp, summary.accuracy, copy.lesson.timeValue(summary.seconds))}>
            <div>
              <dt>{copy.lesson.summaryXp}</dt>
              <dd>{summary.xp}</dd>
            </div>
            <div>
              <dt>{copy.lesson.summaryAccuracy}</dt>
              <dd>{copy.lesson.accuracyValue(summary.accuracy)}</dd>
            </div>
            <div>
              <dt>{copy.lesson.summaryTime}</dt>
              <dd>{copy.lesson.timeValue(summary.seconds)}</dd>
            </div>
          </dl>
          {summary.perfectBonus ? <p className="beat-tag">{copy.lesson.perfect(summary.perfectBonus)}</p> : null}
          {summary.best >= 3 ? <p className="hints-used">{copy.lesson.bestCombo(summary.best)}</p> : null}
        </section>
      ) : null}
      {recap ? <p>{recap}</p> : null}
      {goalMet ? <p className="beat-tag">{copy.lesson.goalMet}</p> : null}
      {hints != null && hints > 0 ? (
        <p className="hints-used">
          {copy.lesson.hintsUsed(hints)}
        </p>
      ) : null}
      <div className="flow-actions">{children}</div>
    </>
  );
}
