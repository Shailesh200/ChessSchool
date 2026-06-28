"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Measure a container and return the largest square (px) that fits inside it —
 * so a chess board can span the full available height (or width, whichever is
 * smaller) instead of a hard-coded calc(). Attach `ref` to the flex container.
 */
export function useSquareSize(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect();
      setSize(Math.floor(Math.min(r.width, r.height)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, size];
}
