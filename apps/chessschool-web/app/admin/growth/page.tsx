"use client";

import { ApiError, type GrowthStats } from "@chessschool/design";
import { useEffect, useState } from "react";
import { Button, Card, TopBar } from "@/components/ui";
import { api } from "@/lib/api";

const pct = (n: number | null) => (n === null ? "n/a" : `${n}%`);

/** One line through `values`, as an inline SVG. */
function Sparkline({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const d = values.map((v, i) => `${i ? "L" : "M"}${((i / Math.max(1, values.length - 1)) * 118 + 1).toFixed(1)} ${(27 - (v / max) * 26).toFixed(1)}`).join(" ");
  return (
    <svg className="sparkline" viewBox="0 0 120 28" width={120} height={28} role="img" aria-label={label}>
      <path d={d} />
    </svg>
  );
}

/** Internal growth dashboard (admin accounts only): return rates, stickiness, shares, invites, crash-free sessions. */
export default function GrowthPage() {
  const [s, setS] = useState<GrowthStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    api.adminGrowth().then(setS, (err) => setError(err instanceof ApiError && err.status === 401 ? "Sign in with the admin account to see this page." : err instanceof ApiError && err.status === 403 ? "This account can't open the admin page." : "Couldn't load the numbers. Try again."));
  }, []);
  if (!s) {
    return (
      <div className="page page-narrow">
        <TopBar title="Growth" backHref="/admin" />
        <p className="page-lead" aria-live="polite">
          {error ?? "Loading…"}
        </p>
        {error ? <Button href="/login">Sign in</Button> : null}
      </div>
    );
  }
  const daily = s.daily.map((d) => d.installs);
  const rows: [string, string, string, React.ReactNode?][] = [
    ["Day-1 return", pct(s.retention.d1), `${s.retention.cohort.d1} installs old enough`],
    ["Day-7 return", pct(s.retention.d7), `${s.retention.cohort.d7} installs old enough`],
    ["Day-30 return", pct(s.retention.d30), `${s.retention.cohort.d30} installs old enough`],
    ["Daily users / monthly users", pct(s.stickiness), `${s.mau} installs active in 30 days`, <Sparkline key="d" values={daily} label={`Active installs per day, last 30 days: ${daily.join(", ")}`} />],
    ["Crash-free sessions", pct(s.crashFree), s.crashFree === null ? "Crash reporter token not set, or no data" : "From the crash reporter, cached for an hour"],
    ["Shares per active learner", s.sharesPerActive === null ? "n/a" : String(s.sharesPerActive), `${s.shares} shares in 30 days`],
    ["Invite conversion", pct(s.invites.conversion), `${s.invites.rewarded} of ${s.invites.accepted} invited friends finished 3 lessons`],
  ];
  return (
    <div className="page page-narrow">
      <TopBar title="Growth" backHref="/admin" />
      <p className="page-lead">Numbers for {s.day} (UTC days). Installs are anonymous device ids from usage events, kept 180 days.</p>
      <Card>
        <table className="growth-table" data-testid="growth-table">
          <thead>
            <tr>
              <th scope="col">Metric</th>
              <th scope="col">Value</th>
              <th scope="col">Based on</th>
              <th scope="col">Trend</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([name, value, basis, trend]) => (
              <tr key={name}>
                <th scope="row">{name}</th>
                <td>
                  <strong>{value}</strong>
                </td>
                <td className="muted">{basis}</td>
                <td>{trend ?? null}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
