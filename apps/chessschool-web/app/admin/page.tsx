"use client";

import { ApiError, copy, type AdminReport, type UsageSummary } from "@chessschool/design";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Button, Card, Segmented, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";

type Load = { state: "loading" } | { state: "signin" } | { state: "forbidden" } | { state: "error" } | { state: "ok"; usage: UsageSummary; reports: AdminReport[] };
const RANGES = [7, 30, 90] as const;

/** Internal dashboard: anonymous usage and the class report queue. Only ADMIN_EMAILS accounts get data. */
export default function AdminPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [showResolved, setShowResolved] = useState(false);
  const course = useCourse();
  const toast = useToast();

  const fetchAll = useCallback(() => {
    Promise.all([api.adminUsage(days), api.adminReports()])
      .then(([usage, r]) => setLoad({ state: "ok", usage, reports: r.reports }))
      .catch((err) => setLoad({ state: err instanceof ApiError && err.status === 401 ? "signin" : err instanceof ApiError && err.status === 403 ? "forbidden" : "error" }));
  }, [days]);
  useEffect(fetchAll, [fetchAll]);

  if (load.state !== "ok") {
    const msg = { loading: "Loading…", signin: "Sign in with the admin account to see this page.", forbidden: "This account can't open the admin page.", error: "Couldn't load the numbers. Try again." }[load.state];
    return (
      <div className="page page-narrow">
        <TopBar title="Admin" back={false} />
        <p className="page-lead" aria-live="polite">
          {msg}
        </p>
        {load.state === "signin" ? <Button href="/login">Sign in</Button> : null}
        {load.state === "error" ? <Button onClick={fetchAll}>Try again</Button> : null}
      </div>
    );
  }

  const { usage, reports } = load;
  const title = (id: string) => course?.lessons.find((l) => l.id === id)?.title ?? id;
  const started = usage.lessons.reduce((n, l) => n + l.starts, 0);
  const finished = usage.lessons.reduce((n, l) => n + l.finishes, 0);
  const open = reports.filter((r) => r.status === "open");
  const shown = showResolved ? reports : open;
  const lessons = [...usage.lessons].filter((l) => l.starts > 0).sort((a, b) => a.completion - b.completion || b.starts - a.starts);
  // Every day in the range, so quiet days show as gaps rather than wider bars.
  const byDay = new Map(usage.daily.map((d) => [d.day, d.installs]));
  const daily = Array.from({ length: usage.days }, (_, i) => {
    const day = new Date(Date.now() - (usage.days - 1 - i) * 86_400_000).toISOString().slice(0, 10);
    return { day, installs: byDay.get(day) ?? 0 };
  });
  const peak = Math.max(1, ...daily.map((d) => d.installs));
  const share = (p: string) => {
    const n = usage.platforms.find((x) => x.platform === p)?.installs ?? 0;
    return usage.installs ? Math.round((n / usage.installs) * 100) : 0;
  };

  const resolve = async (r: AdminReport) => {
    try {
      await api.resolveReport(r.id, r.status === "open" ? "resolved" : "open");
      fetchAll();
    } catch {
      toast(copy.auth.errors.generic);
    }
  };

  return (
    <div className="page admin">
      <TopBar title="Admin" back={false} />
      <div className="admin-head">
        <p className="page-lead">Anonymous installs only: no names, emails or accounts.</p>
        <Segmented label="Range" value={days} onChange={setDays} options={RANGES.map((d) => ({ value: d, label: `${d} days` }))} />
      </div>

      <div className="admin-kpis">
        <Kpi label="Active installs" value={usage.installs.toLocaleString()} sub={`iOS ${share("ios")}% · Android ${share("android")}% · Web ${share("web")}%`} />
        <Kpi label="Lesson completion" value={started ? `${Math.round((finished / started) * 100)}%` : "–"} sub={`${started.toLocaleString()} started · ${finished.toLocaleString()} finished`} />
        <Kpi label="Puzzles solved" value={usage.puzzles.solved.toLocaleString()} sub={`${usage.puzzles.failed.toLocaleString()} failed attempts · ${usage.games.toLocaleString()} games`} />
        <Kpi label="Open reports" value={String(open.length)} sub={open.length ? `Oldest ${ago(Math.min(...open.map((r) => r.createdAt)))}` : "Nothing waiting"} danger={open.length > 0} />
      </div>

      <Card>
        <h2 className="card-title">Daily active installs</h2>
        {usage.installs ? (
          <>
            <div className="admin-bars" role="list" aria-label="Daily active installs">
              {daily.map((d) => (
                <div key={d.day} role="listitem" className={`admin-bar${d.installs ? "" : " empty"}`} style={{ height: d.installs ? `${Math.max(2, (d.installs / peak) * 100)}%` : "2px" }} title={`${d.day}: ${d.installs}`} aria-label={`${d.day}: ${d.installs} installs`} />
              ))}
            </div>
            <div className="admin-axis">
              <span>{daily[0].day}</span>
              <span>{daily[daily.length - 1].day}</span>
            </div>
          </>
        ) : (
          <p className="muted">No events in this range yet.</p>
        )}
      </Card>

      <div className="admin-split">
        <Card className="admin-lessons">
          <h2 className="card-title">Lessons people leave</h2>
          <p className="muted">Lowest completion first.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Lesson</th>
                  <th scope="col" className="num">Started</th>
                  <th scope="col">Completion</th>
                  <th scope="col" className="num">Most quit at</th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.lesson}>
                    <td>{title(l.lesson)}</td>
                    <td className="num">{l.starts}</td>
                    <td>
                      <span className="admin-meter" aria-hidden>
                        <span className={l.completion < 55 ? "low" : l.completion < 70 ? "mid" : "high"} style={{ width: `${l.completion}%` }} />
                      </span>
                      {l.completion}%
                    </td>
                    <td className="num">{l.topQuitStep === null ? "–" : `step ${l.topQuitStep + 1}`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lessons.length ? null : <p className="muted">No lessons started in this range.</p>}
          </div>
        </Card>

        <Card className="admin-reports">
          <h2 className="card-title">Reports</h2>
          {shown.length ? (
            <ul className="admin-report-list">
              {shown.map((r) => (
                <li key={r.id} className="admin-report">
                  <div className="admin-report-meta">
                    <span className={`chip ${r.reason === "name" ? "chip-accent" : r.reason === "behaviour" ? "chip-gold" : ""}`}>{copy.classroom.reasons[r.reason] ?? r.reason}</span>
                    <span className="muted">
                      {r.className ?? "Closed class"} · {ago(r.createdAt)}
                    </span>
                  </div>
                  <p>
                    <strong>{r.reported ?? "Deleted account"}</strong> reported by {r.reporter ?? "a deleted account"}
                  </p>
                  {r.note ? <p className="muted">“{r.note}”</p> : null}
                  <Button variant="secondary" onClick={() => void resolve(r)}>
                    {r.status === "open" ? "Mark resolved" : "Reopen"}
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="muted">No open reports.</p>
          )}
          {reports.length > open.length ? (
            <button type="button" className="link" onClick={() => setShowResolved(!showResolved)}>
              {showResolved ? "Hide resolved" : `Show resolved (${reports.length - open.length})`}
            </button>
          ) : null}
        </Card>
      </div>
      <Link href="/today" className="link-muted">
        Back to the app
      </Link>
    </div>
  );
}

function Kpi({ label, value, sub, danger }: { label: string; value: string; sub: string; danger?: boolean }) {
  return (
    <Card className="admin-kpi">
      <span className="muted">{label}</span>
      <strong className={danger ? "danger" : undefined}>{value}</strong>
      <span className="admin-kpi-sub">{sub}</span>
    </Card>
  );
}

function ago(ms: number) {
  const h = Math.round((Date.now() - ms) / 3_600_000);
  if (h < 1) return "just now";
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
