"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { Cody } from "./Lottie";

const W = 132;
const H = 44;

/**
 * Chaukor AI: a draggable button that floats over the screen (it never moves the layout). Tapping it asks
 * for help; a note arrives as a one-line bubble under it, and tapping the bubble opens the whole note.
 * Drag it anywhere; it snaps to the nearer side and stays on screen. Until dragged it sits where it is
 * rendered: an empty slot of its size keeps that space free.
 */
export function AiCoachButton({ text, asking, onAsk }: { text: string | null; asking: boolean; onAsk: () => void }) {
  const anchor = useRef<HTMLSpanElement>(null);
  const [home, setHome] = useState<{ top: number; right: number } | null>(null);
  useEffect(() => {
    // The pill covers its reserved slot exactly; measured again whenever the page around it moves.
    const place = () => {
      const r = anchor.current?.getBoundingClientRect();
      if (r) setHome({ top: Math.max(8, Math.min(window.innerHeight - H - 8, r.top)), right: Math.max(12, window.innerWidth - r.right) });
    };
    place();
    const watch = new ResizeObserver(place);
    watch.observe(document.body);
    if (anchor.current?.parentElement) watch.observe(anchor.current.parentElement);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      watch.disconnect();
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, []);
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [spot, setSpot] = useState<{ side: "left" | "right"; y: number } | null>(null);
  const [live, setLive] = useState<{ x: number; y: number } | null>(null);
  const start = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  // The click that ends a drag is not a tap.
  const dragged = useRef(false);
  useEffect(() => {
    setOpen(Boolean(text));
    setFull(false);
  }, [text]);

  // Once pressed, the drag is followed on the window: a quick first move can leave the pill behind.
  const down = (e: React.PointerEvent) => {
    dragged.current = false;
    start.current = { x: e.clientX, y: e.clientY, moved: false };
    const move = (ev: PointerEvent) => {
      const s = start.current;
      if (!s || (!s.moved && Math.abs(ev.clientX - s.x) + Math.abs(ev.clientY - s.y) < 8)) return;
      s.moved = true;
      ev.preventDefault();
      setLive({ x: Math.max(0, Math.min(window.innerWidth - W, ev.clientX - W / 2)), y: Math.max(0, Math.min(window.innerHeight - H, ev.clientY - H / 2)) });
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
      setSpot({ side: ev.clientX < window.innerWidth / 2 ? "left" : "right", y: Math.max(8, Math.min(window.innerHeight - H - 8, ev.clientY - H / 2)) });
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };
  const click = () => (text ? (open ? setFull((f) => !f) : setOpen(true)) : onAsk());

  const side = spot?.side ?? "right";
  const style: React.CSSProperties = live ? { left: live.x, top: live.y } : spot ? { top: spot.y, [side]: 12 } : home ? { top: home.top, right: home.right } : { visibility: "hidden" };
  return (
    <>
    <span ref={anchor} className="ai-fab-anchor" aria-hidden />
    <div className={`ai-fab ai-fab-${side}${live ? " is-dragging" : ""}`} style={style} onPointerDown={down}>
      <button
        type="button"
        className="ai-fab-btn"
        aria-label={copy.ai.ask}
        title={copy.ai.move}
        aria-expanded={open}
        aria-busy={asking}
        onClick={() => (dragged.current ? (dragged.current = false) : click())}
      >
        {asking ? <span className="spinner ai-fab-spin" aria-hidden /> : <Cody size={28} />}
        <span>{copy.ai.coach}</span>
        {text && !open ? <i className="ai-fab-dot" aria-hidden /> : null}
      </button>
      {open && text ? (
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
    </>
  );
}
