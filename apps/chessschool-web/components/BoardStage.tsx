"use client";

/**
 * The "table": a card with a top bar (coach or opponent), the board, and a bottom bar (you).
 * The board takes the largest square that fits the space left, so it grows on tall screens.
 * `stable` keeps both bars a fixed height so the board never jumps when text changes.
 */
export function BoardStage({ top, bottom, children, className = "", stable = false }: { top: React.ReactNode; bottom: React.ReactNode; children: React.ReactNode; className?: string; stable?: boolean }) {
  return (
    <section className={`stage${stable ? " stage-stable" : ""} ${className}`}>
      <div className="stage-bar stage-top">{top}</div>
      <div className="stage-board">{children}</div>
      {bottom ? <div className="stage-bar stage-bottom">{bottom}</div> : null}
    </section>
  );
}
