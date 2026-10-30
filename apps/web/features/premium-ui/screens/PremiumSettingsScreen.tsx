"use client";

import Link from "next/link";
import { useSettings, type UiKitMode } from "@/core/store/settings.store";
import { PremiumStatsTopbar } from "@/features/premium-ui/shell/PremiumDexShell";
import { useProgression } from "@/core/store/progression.store";

export function PremiumSettingsScreen() {
  const s = useSettings();
  const streak = useProgression((st) => st.streak);
  const xp = useProgression((st) => st.xp);

  return (
    <>
      <PremiumStatsTopbar streak={streak} xp={xp} />
      <div className="pagehead">
        <Link className="icon-btn" href="/profile" aria-label="Back to Profile">
          ←
        </Link>
        <h1>Settings</h1>
      </div>
      <div className="setgrid">
        <section className="grp" aria-label="Display">
          <div className="gl">Display</div>
          <div className="scol">
            <b>App look</b>
            <fieldset className="seg" aria-label="App look">
              {(["premium", "legacy"] as UiKitMode[]).map((kit) => (
                <label key={kit}>
                  <input
                    type="radio"
                    name="uiKit"
                    checked={s.uiKit === kit}
                    onChange={() => s.set("uiKit", kit)}
                  />
                  <span>{kit === "premium" ? "Premium illustrated" : "Classic"}</span>
                </label>
              ))}
            </fieldset>
            <p className="help">Same switch as Theme Studio → App look.</p>
          </div>
        </section>
        <section className="grp" aria-label="Privacy">
          <div className="gl">Privacy</div>
          <div className="srow">
            <span className="rt">
              <b>Share usage analytics</b>
              <span>Anonymous product events</span>
            </span>
            <button
              type="button"
              className="tg"
              role="switch"
              aria-checked={s.shareAnalytics}
              onClick={() => s.set("shareAnalytics", !s.shareAnalytics)}
            />
          </div>
          <div className="srow">
            <span className="rt">
              <b>Share performance data</b>
              <span>Anonymous Web Vitals</span>
            </span>
            <button
              type="button"
              className="tg"
              role="switch"
              aria-checked={s.sharePerformance}
              onClick={() => s.set("sharePerformance", !s.sharePerformance)}
            />
          </div>
        </section>
        <section className="grp" aria-label="Reminders">
          <div className="gl">Reminders</div>
          <Link className="srow" href="/notify" style={{ textDecoration: "none", color: "inherit" }}>
            <span className="rt">
              <b>Daily reminder</b>
              <span>Set time &amp; opt in</span>
            </span>
          </Link>
        </section>
      </div>
    </>
  );
}
