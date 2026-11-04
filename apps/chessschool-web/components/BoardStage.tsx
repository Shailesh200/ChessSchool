"use client";

/**
 * The "table": a card with a top bar (coach or opponent), the board, and a bottom bar (you).
 * The board takes the largest square that fits the space left, so it grows on tall screens.
 */
export function BoardStage({ top, bottom, children, className = "" }: { top: React.ReactNode; bottom: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={`stage ${className}`}>
      <div className="stage-bar stage-top">{top}</div>
      <div className="stage-board">{children}</div>
      {bottom ? <div className="stage-bar stage-bottom">{bottom}</div> : null}
    </section>
  );
}
