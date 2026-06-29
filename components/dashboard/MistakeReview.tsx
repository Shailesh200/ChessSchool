"use client";

import { useState } from "react";
import { ChessBoard } from "@/features/board/ChessBoard";
import type { MistakeEntry } from "@/core/store/progression.store";
import type { BoardArrow, Square } from "@/core/types/chess";

const fmt = (m: string) => m.replace(":", "→");

/** Recent mistakes — tap one to see the exact position + the better move. */
export function MistakeReview({ mistakes }: { mistakes: MistakeEntry[] }) {
  const [open, setOpen] = useState<number | null>(null);

  if (!mistakes.length) {
    return (
      <p className="text-sm font-semibold text-ink-500">
        No mistakes logged yet — when you slip, it&apos;ll show here with the better move.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {mistakes.slice(0, 8).map((m, i) => {
        const [pf, pt] = m.played.split(":");
        const [bf, bt] = m.best.split(":");
        const arrows: BoardArrow[] = [
          { startSquare: pf as Square, endSquare: pt as Square, color: "#ef4444" },
          { startSquare: bf as Square, endSquare: bt as Square, color: "#22c55e" },
        ];
        return (
          <div key={i} className="overflow-hidden rounded-card border border-hairline bg-surface-card">
            <button
              onClick={() => setOpen(open === i ? null : i)}
              className="btn-tactile flex w-full items-center justify-between gap-2 p-3 text-left"
            >
              <span className="min-w-0 truncate text-sm font-bold text-ink">
                <span className="capitalize">{m.tag || "mistake"}</span> · you played {fmt(m.played)}
              </span>
              <span className="shrink-0 text-xs text-ink-500">{open === i ? "▲" : "▼"}</span>
            </button>
            {open === i && (
              <div className="px-3 pb-3">
                <div className="mx-auto max-w-[260px]">
                  <ChessBoard fen={m.fen} interactive={false} arrows={arrows} showNotation />
                </div>
                <p className="mt-2 text-center text-xs font-bold">
                  <span className="text-danger">You played {fmt(m.played)}</span>
                  <span className="text-ink-500"> · </span>
                  <span className="text-success">Better: {fmt(m.best)}</span>
                </p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
