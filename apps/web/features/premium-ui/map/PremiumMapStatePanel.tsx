"use client";

import Link from "next/link";
import type { Catalog } from "@/features/school/structure";
import { KitRouteLoader } from "@/components/motion/KitRouteLoader";
import type { PremiumMapState } from "./mapState";

export function PremiumMapStatePanel({
  state,
  catalog,
  due,
}: {
  state: PremiumMapState;
  catalog: Catalog;
  due: number;
}) {
  if (state === "loading") {
    return (
      <div className="state" data-testid="map-state-loading">
        <KitRouteLoader label="Loading your course map…" />
      </div>
    );
  }

  if (state === "offline") {
    return (
      <div className="content" data-center="content" data-testid="map-state-offline">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill ill-sm" src="/kit/illustrations/offline.webp" alt="" aria-hidden />
        <div className="banner" role="status">
          <span>
            You&apos;re offline. Saved lessons still work, and your progress syncs later.
          </span>
        </div>
        <div className="cs-list">
          <div className="over">Ready offline</div>
          <div className="cs-row cur-row">
            <div className="cs-row__tile">↓</div>
            <div className="cs-row__body">
              <b>Cached lessons</b>
              <span>Ready offline</span>
            </div>
          </div>
          <div className="cs-row">
            <div className="cs-row__body">
              <b>Daily review</b>
              <span>{due} cards ready offline</span>
            </div>
          </div>
          <div className="over" style={{ marginTop: ".5rem" }}>
            Needs internet
          </div>
          <div className="cs-row">
            <div className="cs-row__tile tile-lock">📡</div>
            <div className="cs-row__body">
              <b>Live course map</b>
              <span>Needs internet</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="state" data-testid="map-state-error">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill" src="/kit/illustrations/error.webp" alt="" aria-hidden />
        <h2 className="cs-h2">Couldn&apos;t load your map</h2>
        <p className="muted">Check your connection and try again.</p>
        <button type="button" className="cs-btn cs-btn--soft" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }

  if (state === "empty") {
    return (
      <div className="state" data-testid="map-state-empty">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="ill" src="/kit/illustrations/empty.webp" alt="" aria-hidden />
        <h2 className="cs-h2">Your path starts here</h2>
        <p className="muted">
          Pick your first class, or take a short placement and we&apos;ll choose one for you.
        </p>
        <Link href="/register" className="cs-btn cs-btn--block">
          Pick my first class
        </Link>
        <Link href="/placement" className="cs-btn cs-btn--soft cs-btn--block">
          Take the placement
        </Link>
      </div>
    );
  }

  const cls = catalog.allClasses[0];
  const title = cls?.title ?? "Your class";
  const href = cls ? `/class/${cls.id}` : "/academy";

  return (
    <div data-testid="map-state-normal">
      <div className="cs-card cs-card--feature">
        <div className="cs-unit">
          <div>
            <div className="cs-overline">Stage 1 · Tactics</div>
            <h1 className="cs-h3" style={{ color: "inherit" }}>
              {title}
            </h1>
          </div>
          <div className="cs-ring cs-ring--md" style={{ ["--p" as string]: "25" }} role="img" aria-label="Progress">
            <b>1/4</b>
          </div>
        </div>
      </div>
      <div className="map2">
        <div className="mapcol">
          <div className="cs-map">
            <div className={`cs-node cs-node--current cs-node--r${state === "dark" ? " cs-node--dark" : ""}`}>
              <Link href={href} className="cs-node__dot">
                <span className="cs-node__start">START</span>
              </Link>
              <div className="cs-node__label">
                <b>{title}</b>
                <span>Up next</span>
              </div>
            </div>
          </div>
        </div>
        <div className="rail">
          <div className="cs-row revcard">
            <div className="cs-row__body">
              <b>Review · {due} due</b>
              <span>10 steps or fewer</span>
            </div>
            <Link href="/review" className="cs-btn cs-btn--soft cs-btn--sm">
              Start
            </Link>
          </div>
          <div className="cs-coach">
            <span className="cs-avatar cs-avatar--md t-otto m-neutral">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/kit/accents/otto/neutral.webp" alt="Otto" />
            </span>
            <div className="cs-bubble">Forks next. You&apos;ve got this!</div>
          </div>
        </div>
      </div>
    </div>
  );
}
