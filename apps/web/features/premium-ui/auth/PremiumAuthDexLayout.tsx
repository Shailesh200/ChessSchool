"use client";

import type { ReactNode } from "react";

export type OttoHeadMood = "neutral" | "happy" | "encouraging" | "thinking";
export type OttoBodyAccent = "neutral" | "celebrating";

const HEAD_VAR: Record<OttoHeadMood, string> = {
  neutral: "var(--head-otto-neutral)",
  happy: "var(--head-otto-happy)",
  encouraging: "var(--head-otto-encouraging)",
  thinking: "var(--head-otto-thinking)",
};

const OTTO_LINE_DEFAULT: Record<OttoHeadMood, string> = {
  neutral: "No stress. Tell me your email and I'll send a link.",
  happy: "Link's on its way. Check your inbox.",
  encouraging: "Almost. Check the email and try once more.",
  thinking: "Pick something you will remember. Longer is stronger.",
};

export function PremiumAuthDexLayout({
  screen,
  state,
  mood = "neutral",
  bodyAccent = "neutral",
  line,
  title,
  muted,
  children,
}: {
  screen: "19a-forgot-password" | "19b-reset-password";
  state: string;
  mood?: OttoHeadMood;
  bodyAccent?: OttoBodyAccent;
  line?: string;
  title: ReactNode;
  muted?: ReactNode;
  children: ReactNode;
}) {
  const say = line ?? OTTO_LINE_DEFAULT[mood];
  const acc =
    bodyAccent === "celebrating" ? "var(--acc-otto-celebrating,var(--acc-brand))" : "var(--acc-otto-neutral,var(--acc-brand))";

  return (
    <div id="root" className="dex-screen">
      <div className="authwrap" data-center="">
        <div className="stage" aria-hidden="false">
          <div className="bub top" aria-live="polite">
            <div className="say">
              <span>{say}</span>
            </div>
          </div>
          <div
            className="gframe figf"
            data-mo="otto"
            style={{
              ["--g1" as string]: "#FFF1BF",
              ["--g2" as string]: "#F5C451",
              ["--acc" as string]: acc,
            }}
          >
            <div
              className="art fig clf fig"
              role="img"
              aria-label="Otto"
              data-coach="otto"
              data-mood={bodyAccent === "celebrating" ? "body-celebrate" : "body-idle"}
            />
          </div>
        </div>
        <main className="authcol" id="main" tabIndex={-1}>
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
          <div className="coachrow">
            <span
              className="head"
              style={{ ["--art" as string]: HEAD_VAR[mood], ["--s" as string]: "4rem" }}
              role="img"
              aria-label="Otto"
              data-coach="otto"
              data-mood={mood}
            />
            <div className="bub" aria-live="polite">
              <div className="say">
                <span>{say}</span>
              </div>
            </div>
          </div>
          <h1>{title}</h1>
          {muted ? <p className="muted">{muted}</p> : null}
          {children}
        </main>
      </div>
    </div>
  );
}

export function PremiumAuthDexRoot({
  screen,
  state,
  children,
}: {
  screen: "19a-forgot-password" | "19b-reset-password";
  state: string;
  children: ReactNode;
}) {
  return (
    <div data-screen={screen} data-state={state}>
      {children}
    </div>
  );
}
