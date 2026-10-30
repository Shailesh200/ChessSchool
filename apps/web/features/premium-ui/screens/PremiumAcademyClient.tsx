"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { Catalog } from "@/features/school/structure";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { dueLessonIds } from "@chess-school/progression";
import { resolvePremiumMapState, type PremiumMapState } from "@/features/premium-ui/map/mapState";

function TopChips({ streak, xp }: { streak: number; xp: number }) {
  return (
    <div className="cs-topbar" data-center="topbar">
      <span className="cs-chip cs-chip--streak" aria-label={`${streak} day streak`}>
        <b>{streak}</b> day streak
      </span>
      <span className="cs-chip cs-chip--xp" aria-label={`${xp} XP`}>
        <b>{xp.toLocaleString()}</b> XP
      </span>
    </div>
  );
}

function MapBody({
  state,
  catalog,
  due,
  clsHref,
  title,
}: {
  state: PremiumMapState;
  catalog: Catalog;
  due: number;
  clsHref: string;
  title: string;
}) {
  if (state === "loading") {
    return (
      <div className="cs-card cs-card--feature">
        <p className="cs-body">Loading your course map…</p>
        <div className="lot loader-lot" data-lot="loader" data-loop="1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className="lot__still" src="/premium/assets/lottie-ui/stills/loader.png" alt="" />
        </div>
      </div>
    );
  }
  if (state === "offline") {
    return (
      <div className="cs-card cs-card--feature">
        <h2 className="cs-h3">You&apos;re offline</h2>
        <p className="cs-body">Cached lessons still work. Reconnect to sync progress.</p>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="cs-card cs-card--feature">
        <h2 className="cs-h3">Couldn&apos;t load the map</h2>
        <p className="cs-body">Pull to refresh or try again in a moment.</p>
      </div>
    );
  }
  if (state === "empty") {
    return (
      <div className="cs-card cs-card--feature">
        <h2 className="cs-h3">Your map is empty</h2>
        <p className="cs-body">Enroll to unlock your first class.</p>
        <Link href="/register" className="cs-btn cs-btn--sm">
          Get started
        </Link>
      </div>
    );
  }

  const cls = catalog.allClasses[0];
  const resolvedTitle = cls?.title ?? title;
  const href = cls ? `/class/${cls.id}` : clsHref;

  return (
    <>
      <div className="cs-card cs-card--feature">
        <div className="cs-unit">
          <div>
            <div className="cs-overline">Stage 1 · Tactics</div>
            <h1 className="cs-h3" style={{ color: "inherit" }}>
              {resolvedTitle}
            </h1>
          </div>
          <div className="cs-ring cs-ring--md" style={{ ["--p" as string]: "25" }} role="img">
            <b>1/4</b>
          </div>
        </div>
      </div>
      <div className="map2">
        <div className="mapcol">
          <div className="cs-map">
            <div className="cs-node cs-node--current cs-node--r">
              <Link href={href} className="cs-node__dot">
                <span className="cs-node__start">START</span>
              </Link>
              <div className="cs-node__label">
                <b>{resolvedTitle}</b>
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
    </>
  );
}

export function PremiumAcademyClient({ catalog }: { catalog: Catalog }) {
  const mounted = useMounted();
  const ready = useRehydrateReady();
  const streak = useProgression((s) => s.streak);
  const xp = useProgression((s) => s.xp);
  const lessons = useProgression((s) => s.lessons);
  const authed = useSession((s) => s.authed);
  const appTheme = useSettings((s) => s.appTheme);
  const [online, setOnline] = useState(true);
  const due = dueLessonIds(lessons).length;

  useEffect(() => {
    const sync = () => setOnline(navigator.onLine);
    sync();
    window.addEventListener("online", sync);
    window.addEventListener("offline", sync);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("offline", sync);
    };
  }, []);

  const mapState = useMemo(
    () =>
      resolvePremiumMapState({
        online,
        ready: mounted && ready,
        loadError: false,
        empty: catalog.allClasses.length === 0,
        dark: appTheme === "midnight",
      }),
    [online, mounted, ready, catalog.allClasses.length, appTheme],
  );

  return (
    <>
      <TopChips streak={mounted ? streak : 0} xp={mounted ? xp : 0} />
      <section className="screen on" data-screen={`map-${mapState}`}>
        <MapBody
          state={mapState}
          catalog={catalog}
          due={due}
          clsHref="/academy"
          title="Your class"
        />
        {authed === false && (
          <p className="cs-body" style={{ marginTop: "1rem" }}>
            <Link href="/login">Log in</Link> to sync progress across devices.
          </p>
        )}
      </section>
    </>
  );
}
