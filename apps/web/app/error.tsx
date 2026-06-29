"use client";

import { useEffect } from "react";

/** Route-level error boundary (#75) — friendly recovery, never a white screen. */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Local-only breadcrumb for the diagnostics/dev view. No analytics.
    try {
      const log = JSON.parse(localStorage.getItem("chessschool.errlog") ?? "[]");
      log.unshift({ t: Date.now(), m: error.message, d: error.digest ?? null });
      localStorage.setItem("chessschool.errlog", JSON.stringify(log.slice(0, 20)));
    } catch {
      /* ignore */
    }
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-surface px-6 text-center">
      <div className="text-5xl">🛟</div>
      <h1 className="text-2xl font-extrabold text-ink">Something hiccuped</h1>
      <p className="max-w-xs text-sm font-semibold text-ink-500">
        Your progress is safe — it&apos;s saved on this device. Let&apos;s get you back to studying.
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        <button
          onClick={reset}
          className="btn-tactile h-12 rounded-pill bg-brand px-6 font-bold text-white [box-shadow:var(--shadow-button)]"
        >
          Recover
        </button>
        <button
          onClick={() => location.reload()}
          className="btn-tactile h-12 rounded-pill border-2 border-hairline bg-surface-card px-6 font-bold text-ink"
        >
          Reload
        </button>
        <button
          onClick={() => location.assign("/")}
          className="btn-tactile flex h-12 items-center rounded-pill border-2 border-hairline bg-surface-card px-6 font-bold text-ink"
        >
          Home
        </button>
      </div>
    </div>
  );
}
