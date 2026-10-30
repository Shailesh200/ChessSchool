"use client";

import Link from "next/link";

export function PremiumNotifySavedScreen() {
  return (
    <div id="root" className="dex-screen" data-screen="15-notify-saved">
      <main className="focus" id="main" tabIndex={-1}>
        <div
          className="gframe logo"
          style={{
            ["--g1" as string]: "#E3F5EC",
            ["--g2" as string]: "#B5E1CC",
            ["--acc" as string]: "var(--acc-brand)",
          }}
        >
          <span className="logo-h" role="img" aria-label="ChessSchool" />
        </div>
        <span
          className="head"
          style={{ ["--art" as string]: "var(--head-otto-celebrating)", ["--s" as string]: "4rem" }}
          role="img"
          aria-label="Otto celebrating"
        />
        <h1 style={{ fontSize: "1.75rem" }}>Reminders are on</h1>
        <p className="muted">We&apos;ll nudge you once a day — no spam.</p>
        <Link href="/academy" className="btn">
          Back to Learn
        </Link>
      </main>
    </div>
  );
}
