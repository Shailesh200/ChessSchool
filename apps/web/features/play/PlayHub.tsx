"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMatch } from "@/core/store/match.store";
import { KitIcon } from "@/components/ui/KitIcon";
import { OPPONENTS, type OpponentId } from "./opponents";

type PlayMode = "coach" | "bot" | "friend";

const MODES: { id: PlayMode; title: string; subtitle: string; icon: string }[] = [
  {
    id: "coach",
    title: "Coach",
    subtitle: "Otto gives tips as you go",
    icon: "graduation-cap",
  },
  { id: "bot", title: "Bot", subtitle: "Play a computer, no hints", icon: "swords" },
  {
    id: "friend",
    title: "Friend",
    subtitle: "Pass and play on one device",
    icon: "users",
  },
];

export function PlayHub() {
  const start = useMatch((s) => s.start);
  const router = useRouter();
  const [mode, setMode] = useState<PlayMode>("coach");
  const [opp, setOpp] = useState<OpponentId>("kira");
  const [ashOn, setAshOn] = useState(false);
  const selected = OPPONENTS.find((o) => o.id === opp) ?? OPPONENTS[1]!;
  const shown = OPPONENTS.filter((o) => !o.optional || ashOn || o.id === opp);

  function begin() {
    if (mode === "friend") {
      start("pass", selected.elo, 0);
    } else {
      start("bot", selected.elo, 0, { thinkingMode: mode === "coach" });
    }
    if (typeof window !== "undefined") {
      sessionStorage.setItem("play-opponent", selected.id);
      sessionStorage.setItem("play-mode", mode);
    }
    router.refresh();
  }

  const subtitle =
    mode === "friend"
      ? "Pass and play"
      : mode === "coach"
        ? `${selected.level} · Otto helps`
        : `${selected.level} · no hints`;

  return (
    <>
      <div className="pagehead">
        <h1>Play</h1>
      </div>
      <section className="hero feat" aria-label="Quick game">
        <div>
          <small>Quick game</small>
          <b className="h">Play {selected.name}</b>
          <span className="s">Warm-up time. Let&apos;s go!</span>
        </div>
        <div
          className="gframe tile heroart"
          data-mo={selected.id}
          style={{
            ["--g1" as string]: selected.glow1,
            ["--g2" as string]: selected.glow2,
            ["--acc" as string]: `var(--acc-${selected.id}-neutral,var(--acc-calm))`,
          }}
        >
          <div
            className="art bust fig"
            style={{ ["--art" as string]: `var(--bust-${selected.id}-neutral)` }}
            role="img"
            aria-label={selected.name}
            data-coach={selected.id}
            data-mood="idle"
          />
        </div>
      </section>
      <div className="hubgrid">
        <div style={{ display: "grid", gap: "0.6rem", minWidth: 0 }}>
          <h2 style={{ fontSize: "1.25rem" }}>How do you want to play?</h2>
          <div className="modes" role="radiogroup" aria-label="Mode">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                role="radio"
                aria-checked={mode === m.id}
                className="mode"
                onClick={() => setMode(m.id)}
              >
                <span className="mi">
                  <KitIcon name={m.icon} />
                </span>
                <span className="rt">
                  <b>{m.title}</b>
                  <span>{m.subtitle}</span>
                </span>
                <span className="dot">
                  <KitIcon name="check" />
                </span>
              </button>
            ))}
          </div>
          <h2 style={{ fontSize: "1.25rem", marginTop: "0.5rem" }}>More</h2>
          <Link className="row" href="/gym">
            <span className="mi">
              <KitIcon name="puzzle" />
            </span>
            <span className="rt">
              <b>Daily puzzle</b>
              <span>New every day</span>
            </span>
            <KitIcon name="chevron-right" />
          </Link>
        </div>
        <div
          style={{ display: "grid", gap: "0.6rem", minWidth: 0, alignContent: "start" }}
        >
          <h2 style={{ fontSize: "1.25rem" }}>Pick who to play</h2>
          <div className="oppo" role="radiogroup" aria-label="Opponent">
            {shown
              .filter((o) => !o.optional)
              .map((o) => (
                <button
                  key={o.id}
                  type="button"
                  role="radio"
                  aria-checked={opp === o.id}
                  className="opp"
                  onClick={() => setOpp(o.id)}
                >
                  <span
                    className="head"
                    style={{
                      ["--art" as string]: `var(--head-${o.id}-neutral)`,
                      ["--s" as string]: "3rem",
                    }}
                    aria-hidden="true"
                    data-coach={o.id}
                    data-mood="idle"
                  />
                  <span className="rt">
                    <b>{o.name}</b>
                    <span>{o.blurb}</span>
                  </span>
                  <span className={`pill ${o.level.toLowerCase()}`}>{o.level}</span>
                </button>
              ))}
          </div>
          <div className="row" style={{ borderStyle: "dashed" }}>
            <span
              className="head"
              style={{
                ["--art" as string]: "var(--head-ash-neutral)",
                ["--s" as string]: "3rem",
              }}
              aria-hidden="true"
              data-coach="ash"
              data-mood="idle"
            />
            <span className="rt">
              <b>Add Ash</b>
              <span>Off by default. Ash is strict and has no hints.</span>
            </span>
            <button
              type="button"
              className="tg"
              role="switch"
              aria-checked={ashOn}
              aria-label="Add Ash to opponents"
              onClick={() => {
                setAshOn((v) => !v);
                if (!ashOn) setOpp("ash");
                else if (opp === "ash") setOpp("kira");
              }}
            />
          </div>
          {ashOn && (
            <button
              type="button"
              role="radio"
              aria-checked={opp === "ash"}
              className="opp"
              onClick={() => setOpp("ash")}
            >
              <span
                className="head"
                style={{
                  ["--art" as string]: "var(--head-ash-neutral)",
                  ["--s" as string]: "3rem",
                }}
                aria-hidden="true"
                data-coach="ash"
                data-mood="idle"
              />
              <span className="rt">
                <b>Ash</b>
                <span>Strict. No hints.</span>
              </span>
              <span className="pill hard">Hard</span>
            </button>
          )}
        </div>
      </div>
      <div className="startbar">
        <span className="rt">
          <b>{mode === "friend" ? "Pass and play" : `Game vs ${selected.name}`}</b>
          <span>{subtitle}</span>
        </span>
        <button type="button" className="btn coral" onClick={begin}>
          Start game
        </button>
      </div>
    </>
  );
}
