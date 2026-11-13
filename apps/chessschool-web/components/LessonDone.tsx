"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef } from "react";
import { Cody, Fx } from "./Lottie";

/** The end-of-lesson moment: stamp, Cody, earned XP and streak, then what's next. */
export function LessonDone({ title, body, recap, xp, streak, goalMet, hints, children }: { title: string; body: string; recap?: string; xp?: number; streak?: number; goalMet?: boolean; hints?: number; children: React.ReactNode }) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, []);
  return (
    <>
      <div className="seal">
        <Fx name="stamp" size={180} className="seal-stamp" />
        <Cody animation="celebrate" size={150} className="seal-cody" label={copy.a11y.mascot} />
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
