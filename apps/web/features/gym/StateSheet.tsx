"use client";

import Link from "next/link";
import { useEffect } from "react";
import { KitIcon } from "@/components/ui/KitIcon";
import { GymScreen } from "./GymScreen";

export type SheetKind = "empty" | "error" | "offline";

const COPY: Record<
  SheetKind,
  {
    title: string;
    body: string;
    art: string;
    primary: string;
    secondary: string;
    icon: string;
  }
> = {
  empty: {
    title: "Nothing here yet",
    body: "Solve a puzzle and it will show up here, so you can find it again.",
    art: "/kit/illustrations/empty.webp",
    primary: "Go to the Gym",
    secondary: "Not now",
    icon: "dumbbell",
  },
  error: {
    title: "Something went wrong",
    body: "We couldn't finish that. Your progress is safe. Try again in a moment.",
    art: "/kit/illustrations/error.webp",
    primary: "Try again",
    secondary: "Back to Gym",
    icon: "refresh-cw",
  },
  offline: {
    title: "You're offline",
    body: "No problem. Puzzles you already opened still work. We will sync your progress when you are back online.",
    art: "/kit/illustrations/offline.webp",
    primary: "Try again",
    secondary: "Keep going offline",
    icon: "wifi-off",
  },
};

export function StateSheet({
  kind,
  onClose,
  fixture = false,
}: {
  kind: SheetKind;
  onClose?: () => void;
  fixture?: boolean;
}) {
  const copy = COPY[kind];
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <>
      <div className="illustrated-under">
        <GymScreen fixture={fixture} />
      </div>
      <div className="illustrated-scrim" />
      <div
        className="illustrated-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="illustrated-sheet-title"
      >
        <span className="grab" aria-hidden="true" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill" src={copy.art} alt="" />
        <h2 id="illustrated-sheet-title">{copy.title}</h2>
        <p className="muted" style={{ maxWidth: "24rem" }}>
          {copy.body}
        </p>
        <div className="acts">
          <Link className="btn" href="/gym" onClick={onClose}>
            <KitIcon name={copy.icon} className="sm" />
            {copy.primary}
          </Link>
          {onClose ? (
            <button type="button" className="btn ghost" onClick={onClose}>
              {copy.secondary}
            </button>
          ) : (
            <Link className="btn ghost" href="/gym">
              {copy.secondary}
            </Link>
          )}
        </div>
      </div>
    </>
  );
}
