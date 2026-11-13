"use client";

import { copy } from "@chessschool/design";
import { useEffect, useState } from "react";

/** Registers the offline worker and offers a refresh when a new one takes over. */
export function ServiceWorker() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production" && !location.search.includes("sw=1")) return;
    const had = Boolean(navigator.serviceWorker.controller);
    const onChange = () => {
      if (had) setReady(true);
    };
    navigator.serviceWorker.addEventListener("controllerchange", onChange);
    navigator.serviceWorker.register("/sw.js").catch(() => {});
    return () => navigator.serviceWorker.removeEventListener("controllerchange", onChange);
  }, []);

  if (!ready) return null;
  return (
    <div className="update-banner" role="status">
      <div>
        <strong>{copy.update.title}</strong>
        <p>{copy.update.web}</p>
      </div>
      <button type="button" className="update-later" onClick={() => setReady(false)}>
        {copy.update.later}
      </button>
      <button type="button" className="update-go" onClick={() => location.reload()}>
        {copy.update.action}
      </button>
    </div>
  );
}
