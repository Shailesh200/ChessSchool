"use client";

import { useEffect, useState } from "react";

const MESSAGES = [
  "Hang tight…",
  "Setting up the board…",
  "Almost there…",
  "Loading your lesson…",
  "Just a moment…",
];

/** Comprehensive in-app navigation loader with a rotating message. */
export default function Loading() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const iv = setInterval(() => setI((x) => x + 1), 1100);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="bg-surface flex min-h-dvh flex-col items-center justify-center gap-5">
      <div className="relative h-16 w-16">
        <div className="border-hairline border-t-brand absolute inset-0 animate-spin rounded-full border-[3px]" />
        <div className="absolute inset-0 flex animate-pulse items-center justify-center text-3xl">
          ♟️
        </div>
      </div>
      <p className="text-ink-700 text-sm font-extrabold tracking-tight">
        {MESSAGES[i % MESSAGES.length]}
      </p>
      <div className="flex gap-1.5">
        {[0, 1, 2].map((d) => (
          <span
            key={d}
            className="bg-brand h-1.5 w-1.5 animate-bounce rounded-full"
            style={{ animationDelay: `${d * 0.15}s` }}
          />
        ))}
      </div>
    </div>
  );
}
