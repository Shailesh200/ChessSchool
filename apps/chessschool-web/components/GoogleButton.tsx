"use client";

import { copy } from "@chessschool/design";
import { useEffect, useRef, useState } from "react";
import { GoogleMark } from "./Icon";

type Gis = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void; ux_mode?: string }) => void;
      renderButton: (el: HTMLElement, o: Record<string, unknown>) => void;
    };
  };
};
declare global {
  interface Window {
    google?: Gis;
  }
}

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;

/**
 * Half-width Google action. The official button is stretched over a labelled face
 * so the row can read "Google" beside Guest. Renders nothing when no client ID is set.
 */
export function GoogleButton({ onToken }: { onToken: (idToken: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onToken);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    cb.current = onToken;
  }, [onToken]);

  useEffect(() => {
    if (!CLIENT_ID) return;
    let dead = false;
    const render = () => {
      const el = ref.current;
      if (dead || !window.google || !el) return;
      const width = Math.max(120, Math.floor(el.clientWidth));
      el.replaceChildren();
      window.google.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (r) => cb.current(r.credential),
        ux_mode: "popup",
      });
      window.google.accounts.id.renderButton(el, { theme: "outline", size: "large", shape: "pill", text: "continue_with", width });
    };
    const ro = new ResizeObserver(() => render());
    if (window.google) render();
    if (ref.current) ro.observe(ref.current);
    if (!window.google) {
      const s = document.createElement("script");
      s.src = "https://accounts.google.com/gsi/client";
      s.async = true;
      s.onload = render;
      s.onerror = () => setFailed(true);
      document.head.appendChild(s);
    }
    return () => {
      dead = true;
      ro.disconnect();
    };
  }, []);

  if (!CLIENT_ID) return null;
  const label = copy.auth.googleShort.trim();
  if (!label) return null;
  return (
    <div style={{ position: "relative", flex: 1, minWidth: 0, minHeight: 48 }}>
      <div
        aria-hidden
        style={{
          minHeight: 48,
          borderRadius: 999,
          border: "2px solid var(--cs-line)",
          background: "var(--cs-card)",
          color: "var(--cs-text)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "0 10px",
          fontWeight: 600,
        }}
      >
        <GoogleMark />
        <span>{label}</span>
      </div>
      {failed ? (
        <p className="field-hint" style={{ margin: "6px 0 0" }}>
          {copy.auth.googleUnavailable}
        </p>
      ) : (
        <div ref={ref} style={{ position: "absolute", inset: 0, opacity: 0, overflow: "hidden" }} />
      )}
    </div>
  );
}
