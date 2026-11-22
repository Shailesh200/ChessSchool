"use client";

import {
  ApiError,
  copy,
  countryName,
  flagOf,
  type AdminMetrics,
  type AdminReport,
  type UsageSummary,
} from "@chessschool/design";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart, fillDays } from "@/components/admin/BarChart";
import { Button, Card, Segmented, TopBar, useToast } from "@/components/ui";
import { api } from "@/lib/api";
import { useCourse } from "@/lib/course";

type Load =
  | { state: "loading" }
  | { state: "signin" }
  | { state: "forbidden" }
  | { state: "error" }
  | { state: "ok"; usage: UsageSummary; metrics: AdminMetrics; reports: AdminReport[] };
const RANGES = [7, 30, 90] as const;

/** Internal dashboard: anonymous usage and the class report queue. Only ADMIN_EMAILS accounts get data. */
export default function AdminPage() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [load, setLoad] = useState<Load>({ state: "loading" });
  const [showResolved, setShowResolved] = useState(false);
  const course = useCourse();
  const toast = useToast();

  const fetchAll = useCallback(() => {
    Promise.all([api.adminUsage(days), api.adminMetrics(days), api.adminReports()])
      .then(([usage, metrics, r]) =>
        setLoad({ state: "ok", usage, metrics, reports: r.reports }),
      )
      .catch((err) =>
        setLoad({
          state:
            err instanceof ApiError && err.status === 401
              ? "signin"
              : err instanceof ApiError && err.status === 403
                ? "forbidden"
                : "error",
        }),
      );
  }, [days]);
  useEffect(fetchAll, [fetchAll]);

  if (load.state !== "ok") {
    const msg = {
      loading: "Loading…",
      signin: "Sign in with the admin account to see this page.",
      forbidden: "This account can't open the admin page.",
      error: "Couldn't load the numbers. Try again.",
    }[load.state];
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

  const { usage, metrics, reports } = load;
  const title = (id: string) => course?.lessons.find((l) => l.id === id)?.title ?? id;
  const started = usage.lessons.reduce((n, l) => n + l.starts, 0);
  const finished = usage.lessons.reduce((n, l) => n + l.finishes, 0);
  const open = reports.filter((r) => r.status === "open");
  const shown = showResolved ? reports : open;
  const lessons = [...usage.lessons]
    .filter((l) => l.starts > 0)
    .sort((a, b) => a.completion - b.completion || b.starts - a.starts);
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
      <TopBar
        title="Admin"
        back={false}
        action={
          <span className="admin-links">
            <Button variant="secondary" href="/admin/growth">
              Growth
            </Button>
            <Button variant="secondary" href="/admin/safety">
              Safety
            </Button>
            <Button variant="secondary" href="/admin/lessons">
              Lesson editor
            </Button>
          </span>
        }
      />
      <div className="admin-head">
        <p className="page-lead">
          Installs are anonymous app and website installs that opened at least once.
          Test builds and QA accounts are left out.
        </p>
        <Segmented
          label="Range"
          value={days}
          onChange={setDays}
          options={RANGES.map((d) => ({ value: d, label: `${d} days` }))}
        />
      </div>

      <div className="admin-kpis">
        <Kpi
          label="Active installs"
          value={usage.installs.toLocaleString()}
          sub={`iOS ${share("ios")}% · Android ${share("android")}% · Web ${share("web")}%`}
        />
        <Kpi
          label="Accounts"
          value={metrics.accounts.total.toLocaleString()}
          sub={`${metrics.accounts.new} new · ${metrics.accounts.activeLearners} active learners`}
        />
        <Kpi
          label="Lesson completion"
          value={started ? `${Math.round((finished / started) * 100)}%` : "–"}
          sub={`${started.toLocaleString()} started · ${finished.toLocaleString()} finished`}
        />
        <Kpi
          label="Puzzles solved"
          value={usage.puzzles.solved.toLocaleString()}
          sub={`${usage.puzzles.failed.toLocaleString()} failed attempts · ${usage.games.toLocaleString()} games`}
        />
        <Kpi
          label="Open reports"
          value={String(open.length)}
          sub={
            open.length
              ? `Oldest ${ago(Math.min(...open.map((r) => r.createdAt)))}`
              : "Nothing waiting"
          }
          danger={open.length > 0}
        />
      </div>

      <div className="admin-grid">
        <Card>
          <h2 className="card-title">Daily active installs</h2>
          {usage.installs ? (
            <BarChart
              points={fillDays(
                usage.daily.map((d) => ({ day: d.day, n: d.installs })),
                usage.days,
              )}
              label="Daily active installs"
              unit="installs"
            />
          ) : (
            <p className="muted">No events in this range yet.</p>
          )}
        </Card>
        <Card>
          <h2 className="card-title">New accounts</h2>
          <BarChart
            points={fillDays(metrics.accounts.daily, metrics.days)}
            label="New accounts"
            unit="accounts"
          />
        </Card>
      </div>

      <h2 className="admin-section-title">Playing</h2>
      <div className="admin-grid">
        <Card>
          <h2 className="card-title">Games saved</h2>
          <ul className="admin-rows">
            <Row k="Games" v={metrics.games.total} />
            <Row k="Against bots" v={metrics.games.bot} />
            <Row k="Against friends" v={metrics.games.friend} />
            <Row
              k="Won · lost · drawn"
              v={`${metrics.games.won} · ${metrics.games.lost} · ${metrics.games.drawn}`}
            />
            <Row
              k="Win rate"
              v={`${metrics.games.total ? Math.round((metrics.games.won / metrics.games.total) * 100) : 0}%`}
            />
          </ul>
          <p className="muted small">
            Signed-in players only; guests keep games on their device.
          </p>
        </Card>
        <Card>
          <h2 className="card-title">Bots played</h2>
          {metrics.games.bots.length ? (
            <ul className="admin-rows">
              {metrics.games.bots.map((b) => (
                <Row
                  key={b.bot}
                  k={b.bot[0].toUpperCase() + b.bot.slice(1)}
                  v={`${b.played} games · ${Math.round((b.won / b.played) * 100)}% won`}
                />
              ))}
            </ul>
          ) : (
            <p className="muted">No bot games in this range.</p>
          )}
        </Card>
        <Card>
          <h2 className="card-title">Friend challenges</h2>
          <ul className="admin-rows">
            <Row k="Links made" v={metrics.challenges.created} />
            <Row
              k="Friend joined"
              v={`${metrics.challenges.joined} (${metrics.challenges.created ? Math.round((metrics.challenges.joined / metrics.challenges.created) * 100) : 0}%)`}
            />
            <Row k="Finished" v={metrics.challenges.finished} />
            {Object.entries(metrics.challenges.byClock).map(([tc, n]) => (
              <Row key={tc} k={`Clock: ${tc === "none" ? "no clock" : tc}`} v={n} />
            ))}
          </ul>
        </Card>
      </div>

      <div className="admin-grid">
        <Card>
          <h2 className="card-title">Daily puzzle solves</h2>
          <BarChart
            points={fillDays(metrics.dailyPuzzle.daily, metrics.days)}
            label="Daily puzzle solves"
            unit="solves"
          />
        </Card>
        <Card>
          <h2 className="card-title">AI coach requests</h2>
          <BarChart
            points={fillDays(metrics.ai.daily, metrics.days)}
            label="AI coach requests"
            unit="requests"
          />
          <p className="muted small">
            Hints and explanations; busiest day had {metrics.ai.users} players using it.
          </p>
        </Card>
      </div>

      <h2 className="admin-section-title">People</h2>
      <div className="admin-grid">
        <Card>
          <h2 className="card-title">Sign-in methods</h2>
          <ul className="admin-rows">
            <Row k="Email and password" v={metrics.accounts.methods.password} />
            <Row k="Google" v={metrics.accounts.methods.google} />
            <Row k="Apple" v={metrics.accounts.methods.apple} />
          </ul>
        </Card>
        <Card>
          <h2 className="card-title">Countries</h2>
          {metrics.countries.length ? (
            <ul className="admin-rows">
              {metrics.countries.map((c) => (
                <Row
                  key={c.country}
                  k={`${flagOf(c.country)} ${countryName(c.country)}`}
                  v={c.n}
                />
              ))}
            </ul>
          ) : (
            <p className="muted">No one has picked a country yet.</p>
          )}
        </Card>
        <Card>
          <h2 className="card-title">Support and safety</h2>
          <ul className="admin-rows">
            <Row k="Support messages" v={metrics.support} />
            <Row k="Player reports" v={metrics.reports} />
          </ul>
          <Link href="/admin/safety" className="link">
            Open the safety queue
          </Link>
        </Card>
      </div>

      <div className="admin-split">
        <Card className="admin-lessons">
          <h2 className="card-title">Lessons people leave</h2>
          <p className="muted">Lowest completion first.</p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th scope="col">Lesson</th>
                  <th scope="col" className="num">
                    Started
                  </th>
                  <th scope="col">Completion</th>
                  <th scope="col" className="num">
                    Most quit at
                  </th>
                </tr>
              </thead>
              <tbody>
                {lessons.map((l) => (
                  <tr key={l.lesson}>
                    <td>{title(l.lesson)}</td>
                    <td className="num">{l.starts}</td>
                    <td>
                      <span className="admin-meter" aria-hidden>
                        <span
                          className={
                            l.completion < 55
                              ? "low"
                              : l.completion < 70
                                ? "mid"
                                : "high"
                          }
                          style={{ width: `${l.completion}%` }}
                        />
                      </span>
                      {l.completion}%
                    </td>
                    <td className="num">
                      {l.topQuitStep === null ? "–" : `step ${l.topQuitStep + 1}`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {lessons.length ? null : (
              <p className="muted">No lessons started in this range.</p>
            )}
          </div>
        </Card>

        <Card className="admin-reports">
          <h2 className="card-title">Reports</h2>
          {shown.length ? (
            <ul className="admin-report-list">
              {shown.map((r) => (
                <li key={r.id} className="admin-report">
                  <div className="admin-report-meta">
                    <span
                      className={`chip ${r.reason === "name" ? "chip-accent" : r.reason === "behaviour" ? "chip-gold" : ""}`}
                    >
                      {copy.reporting.reasons[r.reason] ?? r.reason}
                    </span>
                    <span className="muted">
                      {r.className ?? "Closed class"} · {ago(r.createdAt)}
                    </span>
                  </div>
                  <p>
                    <strong>{r.reported ?? "Deleted account"}</strong> reported by{" "}
                    {r.reporter ?? "a deleted account"}
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
            <button
              type="button"
              className="link"
              onClick={() => setShowResolved(!showResolved)}
            >
              {showResolved
                ? "Hide resolved"
                : `Show resolved (${reports.length - open.length})`}
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

function Row({ k, v }: { k: string; v: string | number }) {
  return (
    <li>
      <span>{k}</span>
      <strong>{typeof v === "number" ? v.toLocaleString() : v}</strong>
    </li>
  );
}

function Kpi({
  label,
  value,
  sub,
  danger,
}: {
  label: string;
  value: string;
  sub: string;
  danger?: boolean;
}) {
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
