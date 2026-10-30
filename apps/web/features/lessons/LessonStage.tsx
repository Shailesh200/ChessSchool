import type { ReactNode } from "react";

/**
 * Shared layout shell for every lesson-style player (lessons, homework, exams,
 * class exams, practice). One place owns the geometry so no screen can drift:
 *
 *  - The shell is exactly one dynamic viewport tall. The header and the footer
 *    are normal flex siblings (never sticky/fixed overlays), so nothing can
 *    ever cover the hint control or rank 1 of the board.
 *  - The middle region is the single scroll container and the size container
 *    (`container-type: size`). The board, the coach bubble cap and the side by
 *    side breakpoint are all derived from ITS size (cqw/cqh), not from guessed
 *    chrome heights, so they stay correct at 200% text, browser zoom, short
 *    landscape phones and every desktop width.
 *  - Portrait: coach, board, controls, tip stacked in normal flow (the region
 *    scrolls when they do not fit). Wide screens and short landscape: board on
 *    the left (sticky), coach/controls/tip on the right.
 *
 * The CSS lives in globals.css under `.lesson-stage*` and is pinned by
 * e2e/lesson-layout.spec.ts.
 */
export function LessonStage({
  header,
  coach,
  board,
  controls,
  tip,
  footer,
}: {
  header: ReactNode;
  coach: ReactNode;
  board: ReactNode;
  controls: ReactNode;
  tip?: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="lesson-stage bg-surface" data-testid="lesson-stage">
      <div className="lesson-stage-header pt-safe bg-surface">{header}</div>
      <div className="lesson-stage-scroll" data-testid="lesson-scroll">
        <div className="lesson-stage-grid">
          <div className="lesson-stage-coach" data-testid="lesson-coach-panel">
            {coach}
          </div>
          <div className="lesson-stage-board" data-testid="lesson-board-slot">
            {board}
          </div>
          <div className="lesson-stage-controls" data-testid="lesson-controls">
            {controls}
          </div>
          {tip ? (
            <div className="lesson-stage-tip" data-testid="lesson-tip">
              {tip}
            </div>
          ) : null}
        </div>
      </div>
      <div className="lesson-stage-footer pb-safe">{footer}</div>
    </div>
  );
}
