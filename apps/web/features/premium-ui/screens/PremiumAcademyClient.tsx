"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Catalog } from "@/features/school/structure";
import { useProgression } from "@/core/store/progression.store";
import { useSession } from "@/core/store/session.store";
import { useSettings } from "@/core/store/settings.store";
import { useMounted } from "@/core/hooks/useMounted";
import { useRehydrateReady } from "@/core/hooks/useRehydrateReady";
import { dueLessonIds } from "@chess-school/progression";
import { resolvePremiumMapState, type PremiumMapState } from "@/features/premium-ui/map/mapState";
import { readPremiumMapPreviewOverride } from "@/features/premium-ui/map/mapPreview";
import { PremiumMapStatePanel } from "@/features/premium-ui/map/PremiumMapStatePanel";
import { useMidnightSurface } from "@/features/premium-ui/useMidnightSurface";

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

export function PremiumAcademyClient({ catalog }: { catalog: Catalog }) {
  const theme = useMidnightSurface();
  const mounted = useMounted();
  const ready = useRehydrateReady();
  const params = useSearchParams();
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

  const preview = readPremiumMapPreviewOverride(params.toString());

  const mapState = useMemo((): PremiumMapState => {
    if (preview) return preview;
    return resolvePremiumMapState({
      online,
      ready: mounted && ready,
      loadError: false,
      empty: catalog.allClasses.length === 0,
      dark: appTheme === "midnight",
    });
  }, [preview, online, mounted, ready, catalog.allClasses.length, appTheme]);

  useEffect(() => {
    const screen = `map-${mapState}`;
    document.body.dataset.screen = screen;
    return () => {
      if (document.body.dataset.screen === screen) {
        delete document.body.dataset.screen;
      }
    };
  }, [mapState]);

  return (
    <>
      <TopChips streak={mounted ? streak : 0} xp={mounted ? xp : 0} />
      <section className="screen on" data-screen={`map-${mapState}`} data-theme={theme}>
        <PremiumMapStatePanel state={mapState} catalog={catalog} due={due} />
        {authed === false && mapState === "normal" && (
          <p className="cs-body" style={{ marginTop: "1rem" }}>
            <Link href="/login">Log in</Link> to sync progress across devices.
          </p>
        )}
      </section>
    </>
  );
}
