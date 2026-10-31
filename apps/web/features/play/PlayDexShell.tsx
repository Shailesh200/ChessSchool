"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { KitIcon } from "@/components/ui/KitIcon";
import { useProgression } from "@/core/store/progression.store";
import { reviewDueCount } from "@/features/review/skills";

const TABS = [
  { href: "/academy", label: "Learn", icon: "house" },
  { href: "/play", label: "Play", icon: "play" },
  { href: "/review", label: "Review", icon: "refresh-cw" },
  { href: "/profile", label: "Profile", icon: "user" },
] as const;

function NavLinks({ due }: { due: number }) {
  return (
    <>
      {TABS.map((tab) => {
        const on = tab.href === "/play";
        const reviewLabel =
          tab.href === "/review" && due > 0 ? `Review, ${due} due` : undefined;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={on ? "on" : undefined}
            aria-current={on ? "page" : undefined}
            aria-label={reviewLabel}
          >
            <KitIcon name={tab.icon} />
            <span>{tab.label}</span>
            {tab.href === "/review" && due > 0 ? (
              <em className="tbadge" aria-hidden="true">
                {due > 9 ? "9+" : due}
              </em>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}

/** Illustrated play chrome: streak chips, sidebar from 1024px, tab bar below. */
export function PlayDexShell({
  screen,
  pad = false,
  children,
}: {
  screen: string;
  pad?: boolean;
  children: ReactNode;
}) {
  const streak = useProgression((s) => s.streak);
  const xp = useProgression((s) => s.xp);
  const lessons = useProgression((s) => s.lessons);
  const due = reviewDueCount(lessons);

  return (
    <div id="root" className="dex-screen" data-screen={screen}>
      <a className="skip" href="#main">
        Skip to main content
      </a>
      <div className="shell" data-center="">
        <nav className="side" aria-label="Main">
          <div
            className="gframe logo slim"
            style={{
              ["--g1" as string]: "#E3F5EC",
              ["--g2" as string]: "#B5E1CC",
              ["--acc" as string]: "var(--acc-calm)",
            }}
          >
            <span className="logo-h" role="img" aria-label="ChessSchool" />
          </div>
          <NavLinks due={due} />
        </nav>
        <div className="col">
          <div className="topbar" role="group" aria-label="Your streak and XP">
            <span className="chip fire">
              <KitIcon name="flame" fill className="sm" />
              <b>{streak}</b> day streak
            </span>
            <span className="chip xp">
              <KitIcon name="zap" fill className="sm" />
              <b>{xp.toLocaleString("en-US")}</b> XP
            </span>
          </div>
          <main className={pad ? "main pad-px" : "main"} id="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <nav className="tabbar" aria-label="Primary">
        <NavLinks due={due} />
      </nav>
    </div>
  );
}
