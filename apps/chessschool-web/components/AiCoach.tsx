"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

/**
 * The AI coach in a game as a corner widget: a Cody button that asks for help, with a one-line bubble
 * when a note arrives (tap it for the whole note). It floats over the game, so it never moves the board,
 * and can be dragged to either side and any height; it snaps to the nearest edge.
 */
export function AiCoachButton({ text, asking, onAsk }: { text: string | null; asking: boolean; onAsk: () => void }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  // null: sits in the toolbar; after a drag it floats at a screen edge.
  const [spot, setSpot] = useState<{ side: "left" | "right"; y: number } | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // The click that ends a drag is not a tap.
  const dragged = useRef(false);
  useEffect(() => {
    setOpen(Boolean(text));
    setFull(false);
  }, [text]);

  const down = (e: React.PointerEvent) => {
    dragged.current = false;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = start.current;
    if (!s || (!s.moved && Math.abs(e.clientX - s.x) + Math.abs(e.clientY - s.y) < 8)) return;
    if (!s.moved) (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    s.moved = true;
    setLive({ x: e.clientX - 26, y: e.clientY - 26 });
  };
  const up = (e: React.PointerEvent) => {
    const s = start.current;
    start.current = null;
    if (!s?.moved) return;
    dragged.current = true;
    setLive(null);
    setSpot({ side: e.clientX < window.innerWidth / 2 ? "left" : "right", y: Math.max(8, Math.min(window.innerHeight - 140, e.clientY - 26)) });
  };
  const click = () => (text ? (open ? setFull((f) => !f) : setOpen(true)) : onAsk());

  const style: React.CSSProperties | undefined = live ? { position: "fixed", left: live.x, top: live.y } : spot ? { position: "fixed", top: spot.y, [spot.side]: 8 } : undefined;
  const side = spot?.side ?? "right";
  return (
    <span className={`ai-fab ai-fab-${side}${spot || live ? " is-floating" : ""}`} style={style} onPointerDown={down} onPointerMove={move} onPointerUp={up}>
      <button
        type="button"
        className="icon-btn ai-fab-btn"
        aria-label={copy.ai.ask}
        aria-expanded={open}
        aria-busy={asking}
        onClick={() => (dragged.current ? (dragged.current = false) : click())}
      >
        <Cody size={36} />
        {text && !open ? <i className="ai-fab-dot" aria-hidden /> : null}
      </button>
      {open && text ? (
        <div className={`ai-fab-note${full ? " is-full" : ""}`} role="status" aria-live="polite">
          <button type="button" className="ai-fab-text" aria-expanded={full} aria-label={full ? undefined : `${copy.ai.coach}: ${text}`} onClick={() => setFull((f) => !f)}>
            {full ? (
              <span className="ai-coach-label">
                <Icon name="sparkles" size={14} />
                {copy.ai.coach}
              </span>
            ) : null}
            <span className="ai-fab-line">{text}</span>
          </button>
          <button type="button" className="ai-fab-close" aria-label={copy.ai.dismiss} onClick={() => setOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </span>
  );
}
