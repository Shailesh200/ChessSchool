"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

const SIZE = 56;

/** Where the learner last left the button, kept while the page is open so it is in the same place on every screen. */
let dock: { side: "left" | "right"; y: number | null } = { side: "right", y: null };

/**
 * Chaukor AI: a floating button docked to the edge of the screen. Drag it up and down an edge or across to
 * the other one; it snaps to the nearer edge. Tapping it asks for help; a note opens as a one-line bubble
 * beside it (tap it for the whole note). It floats over the page, so it never moves the layout.
 */
export function AiCoachButton({ text, asking, onAsk }: { text: string | null; asking: boolean; onAsk: () => void }) {
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [spot, setSpot] = useState(dock);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const [vh, setVh] = useState(800);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // The click that ends a drag is not a tap.
  const dragged = useRef(false);
  useEffect(() => {
    setOpen(Boolean(text));
    setFull(false);
  }, [text]);
  useEffect(() => {
    const size = () => setVh(window.innerHeight);
    size();
    window.addEventListener("resize", size);
    return () => window.removeEventListener("resize", size);
  }, []);
  const clampY = (v: number) => Math.max(8, Math.min(vh - SIZE - 96, v));

  // Once pressed, the drag is followed on the window: a quick first move can leave the button behind.
  const down = (e: React.PointerEvent) => {
    dragged.current = false;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    const move = (ev: PointerEvent) => {
      const s = start.current;
      if (!s || (!s.moved && Math.abs(ev.clientX - s.x) + Math.abs(ev.clientY - s.y) < 8)) return;
      s.moved = true;
      ev.preventDefault();
      setLive({ x: Math.max(0, Math.min(window.innerWidth - SIZE, ev.clientX - SIZE / 2)), y: Math.max(0, Math.min(window.innerHeight - SIZE, ev.clientY - SIZE / 2)) });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const s = start.current;
      start.current = null;
      if (!s?.moved) return;
      dragged.current = true;
      setLive(null);
      dock = { side: ev.clientX < window.innerWidth / 2 ? "left" : "right", y: ev.clientY - SIZE / 2 };
      setSpot(dock);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const click = () => (text ? (open ? setFull((f) => !f) : setOpen(true)) : onAsk());

  const style: React.CSSProperties = live ? { left: live.x, top: live.y } : { top: clampY(spot.y ?? vh * 0.42), [spot.side]: 0 };
  return (
    <div className={`ai-fab ai-fab-${spot.side}${live ? " is-dragging" : ""}`} style={style} onPointerDown={down}>
      <button
        type="button"
        className="ai-fab-btn"
        aria-label={copy.ai.ask}
        title={copy.ai.move}
        aria-expanded={open}
        aria-busy={asking}
        onClick={() => (dragged.current ? (dragged.current = false) : click())}
      >
        {asking ? <span className="spinner ai-fab-spin" aria-hidden /> : <Cody size={38} />}
        {text && !open ? <i className="ai-fab-dot" aria-hidden /> : null}
      </button>
      {open && text && !live ? (
        <div className={`ai-fab-note${full ? " is-full" : ""}`} role="status" aria-live="polite">
          <button type="button" className="ai-fab-text" aria-expanded={full} aria-label={full ? undefined : `${copy.ai.coach}: ${text}`} onClick={() => setFull((f) => !f)}>
            <span className="ai-fab-line">{text}</span>
          </button>
          <button type="button" className="ai-fab-close" aria-label={copy.ai.dismiss} onClick={() => setOpen(false)}>
            <Icon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
