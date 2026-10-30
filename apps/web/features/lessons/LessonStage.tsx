import type { ReactNode } from "react";

/**
 * Shared layout shell for every lesson-style player (lessons, homework, exams,
 * class exams, practice). Premium kit markup (design-kit 05a–08) with coach
 * above a centred board on mobile; board left / coach+extras right from 1024px.
 *
 * Geometry for the live board still comes from `.lesson-stage*` container queries
 * in globals.css — pinned by e2e/lesson-layout.spec.ts via data-testid hooks.
 */
export function LessonStage({
  header,
  coachTitle,
  coach,
  board,
  extras,
  footer,
}: {
  header: ReactNode;
  /** Tag + step title block (`.ttl` in kit). */
  coachTitle?: ReactNode;
  coach: ReactNode;
  board: ReactNode;
  /** Hint ladder, tip, and drill controls (`.lx` in kit). */
  extras?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="lesson-stage lesson-stage--kit bg-surface" data-testid="lesson-stage">
      <div className="lesson-stage-header pt-safe lh">{header}</div>
      <div className="lesson-stage-scroll" data-testid="lesson-scroll">
        <div className="lesson-stage-grid lgrid">
          <div className="lesson-stage-coach lcoach" data-testid="lesson-coach-panel">
            {coachTitle}
            {coach}
          </div>
          <div className="lesson-stage-board lbd" data-testid="lesson-board-slot">
            {board}
          </div>
          {extras ? (
            <div className="lesson-stage-extras lx" data-testid="lesson-extras">
              {extras}
            </div>
          ) : (
            <div className="lesson-stage-extras lx" aria-hidden />
          )}
        </div>
      </div>
      <div className="lesson-stage-footer barwrap pb-safe">{footer}</div>
    </div>
  );
}
