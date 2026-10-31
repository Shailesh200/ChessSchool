"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useMidnightSurface } from "@/features/premium-ui/useMidnightSurface";

export function PremiumNotifyScreen() {
  const router = useRouter();
  const [hour, setHour] = useState("7");
  const [minute, setMinute] = useState("30");
  const [ampm, setAmpm] = useState("PM");
  const theme = useMidnightSurface();

  return (
    <div id="root" className="dex-screen" data-screen="15-notify" data-theme={theme}>
      <main className="focus" id="main" tabIndex={-1}>
        <div className="gframe logo glow-brand">
          <span className="logo-h" role="img" aria-label="ChessSchool" />
        </div>
        <div className="chips" style={{ justifyContent: "center" }}>
          <span className="pill ok">First lesson done</span>
        </div>
        <div className="coachrow">
          <span
            className="head"
            style={{ ["--art" as string]: "var(--head-otto-happy)", ["--s" as string]: "3.5rem" }}
            role="img"
            aria-label="Otto"
          />
          <div className="bub" aria-live="polite">
            <div className="say">
              <span>Great first lesson! Want a small daily reminder to keep your streak going?</span>
            </div>
          </div>
        </div>
        <section className="card" aria-label="Reminder time" style={{ display: "grid", gap: ".75rem" }}>
          <h2 style={{ fontSize: "1.25rem" }}>Remind me at</h2>
          <div className="timesel">
            <div className="field">
              <label htmlFor="th">Hour</label>
              <select className="sel" id="th" value={hour} onChange={(e) => setHour(e.target.value)}>
                {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="tm">Minute</label>
              <select className="sel" id="tm" value={minute} onChange={(e) => setMinute(e.target.value)}>
                {["00", "15", "30", "45"].map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="ta">AM or PM</label>
              <select className="sel" id="ta" value={ampm} onChange={(e) => setAmpm(e.target.value)}>
                <option>AM</option>
                <option>PM</option>
              </select>
            </div>
          </div>
        </section>
        <div className="notif" aria-label="Preview of the reminder">
          <span
            className="head"
            style={{ ["--art" as string]: "var(--head-otto-happy)", ["--s" as string]: "2.75rem" }}
            aria-hidden="true"
          />
          <span className="rt">
            <b>
              ChessSchool · {hour}:{minute} {ampm}
            </b>
            <span>Time for one small win. 5 minutes is enough.</span>
          </span>
        </div>
        <div style={{ display: "grid", gap: ".5rem" }}>
          <button type="button" className="btn coral" onClick={() => router.push("/notify/saved")}>
            Turn on reminders
          </button>
          <Link href="/academy" className="btn ghost">
            Not now
          </Link>
          <p className="help" style={{ textAlign: "center" }}>
            You can change this any time in Settings.
          </p>
        </div>
      </main>
    </div>
  );
}
