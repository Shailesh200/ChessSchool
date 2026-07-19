"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AdminAnalytics as Analytics } from "@/lib/admin-analytics";
import { Card } from "@/components/ui/Card";
import { cn } from "@/components/ui/cn";

type Tab = "overview" | "events" | "lessons" | "users";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "events", label: "Events" },
  { id: "lessons", label: "Lessons" },
  { id: "users", label: "Users" },
];

/** Resolved design-token colors for Recharts (SVG needs concrete paints). */
type ChartTheme = {
  brand: string;
  brandSoft: string;
  accent: string;
  success: string;
  gold: string;
  ink: string;
  inkMuted: string;
  inkFaint: string;
  hairline: string;
  surface: string;
  surfaceCard: string;
  surfaceSunken: string;
  radius: string;
  font: string;
};

const FALLBACK_THEME: ChartTheme = {
  brand: "#5b5bd6",
  brandSoft: "#aab2ff",
  accent: "#ff7a59",
  success: "#10b981",
  gold: "#f6c343",
  ink: "#1c1b2e",
  inkMuted: "#6b6982",
  inkFaint: "#a9a7bd",
  hairline: "#e7e6f2",
  surface: "#fbfaff",
  surfaceCard: "#ffffff",
  surfaceSunken: "#f1f0f9",
  radius: "0.875rem",
  font: "Fredoka, ui-sans-serif, system-ui, sans-serif",
};

function readToken(styles: CSSStyleDeclaration, name: string, fallback: string): string {
  const v = styles.getPropertyValue(name).trim();
  return v || fallback;
}

function readChartTheme(): ChartTheme {
  if (typeof window === "undefined") return FALLBACK_THEME;
  const s = getComputedStyle(document.documentElement);
  return {
    brand: readToken(s, "--brand-500", FALLBACK_THEME.brand),
    brandSoft: readToken(s, "--brand-300", FALLBACK_THEME.brandSoft),
    accent: readToken(s, "--accent-500", FALLBACK_THEME.accent),
    success: readToken(s, "--success-500", FALLBACK_THEME.success),
    gold: readToken(s, "--gold-500", FALLBACK_THEME.gold),
    ink: readToken(s, "--ink-900", FALLBACK_THEME.ink),
    inkMuted: readToken(s, "--ink-500", FALLBACK_THEME.inkMuted),
    inkFaint: readToken(s, "--ink-300", FALLBACK_THEME.inkFaint),
    hairline: readToken(s, "--hairline", FALLBACK_THEME.hairline),
    surface: readToken(s, "--surface", FALLBACK_THEME.surface),
    surfaceCard: readToken(s, "--surface-card", FALLBACK_THEME.surfaceCard),
    surfaceSunken: readToken(s, "--surface-sunken", FALLBACK_THEME.surfaceSunken),
    radius: readToken(s, "--radius-md", FALLBACK_THEME.radius),
    font: readToken(s, "--font-display", FALLBACK_THEME.font) || FALLBACK_THEME.font,
  };
}

function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(FALLBACK_THEME);
  useEffect(() => {
    const apply = () => setTheme(readChartTheme());
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-app-theme", "class", "style"],
    });
    return () => obs.disconnect();
  }, []);
  return theme;
}

export function AdminAnalytics({ data }: { data: Analytics }) {
  const [tab, setTab] = useState<Tab>("overview");
  const theme = useChartTheme();

  const signupChart = useMemo(
    () => data.signupsByDay.map((d) => ({ ...d, label: shortDay(d.day) })),
    [data.signupsByDay],
  );
  const activityChart = useMemo(
    () =>
      data.activityByDay.map((d) => ({
        ...d,
        label: shortDay(d.day),
      })),
    [data.activityByDay],
  );
  const eventsChart = useMemo(
    () => data.eventsByDay.map((d) => ({ ...d, label: shortDay(d.day) })),
    [data.eventsByDay],
  );
  const eventBars = useMemo(
    () =>
      data.events.slice(0, 12).map((e) => ({
        name: e.name,
        count: e.count,
      })),
    [data.events],
  );

  return (
    <section className="flex flex-col gap-4" aria-labelledby="admin-analytics-heading">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="admin-analytics-heading" className="text-ink text-lg font-extrabold">
            Product analytics
          </h2>
          <p className="text-ink-500 text-xs font-semibold">
            Live from the database · {new Date(data.generatedAt).toLocaleString()}
          </p>
        </div>
        <nav
          className="border-hairline bg-surface-sunken flex gap-1 rounded-full border p-1"
          aria-label="Analytics views"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "rounded-full px-3 py-1.5 text-xs font-bold transition",
                tab === t.id
                  ? "bg-surface-card text-ink shadow-sm"
                  : "text-ink-500 hover:text-ink",
              )}
              aria-current={tab === t.id ? "page" : undefined}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Users" value={data.users.total} hint={`${data.users.students} students`} />
        <Stat label="Active 7d" value={data.activity.activeLast7d} hint="Lesson activity" />
        <Stat label="Active 30d" value={data.activity.activeLast30d} />
        <Stat
          label="Signups 30d"
          value={data.users.signedUpLast30d}
          hint={`${data.users.signedUpLast7d} in 7d`}
        />
        <Stat
          label="Lessons started"
          value={data.lessons.started}
          hint={`${data.lessons.totalAttempts} attempts`}
        />
        <Stat
          label="Mastered"
          value={data.lessons.mastered}
          hint={`≥90% · ${data.lessons.catalogSize} catalog`}
        />
      </div>

      {tab === "overview" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Signups · 30 days">
              <LineArea
                data={signupChart}
                dataKey="count"
                color={theme.brand}
                theme={theme}
              />
            </ChartCard>
            <ChartCard title="Active learners · 30 days">
              <LineArea
                data={activityChart}
                dataKey="activeUsers"
                color={theme.success}
                secondaryKey="touches"
                secondaryColor={theme.inkFaint}
                theme={theme}
              />
            </ChartCard>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            <Card className="flex flex-col gap-3 overflow-hidden p-0">
              <div className="border-hairline border-b px-4 py-3">
                <h3 className="text-ink text-sm font-extrabold">Activation funnel</h3>
                <p className="text-ink-500 text-[11px] font-semibold">
                  Event counts · conversion vs previous step
                </p>
              </div>
              <DataTable
                columns={["Step", "Count", "Conv. %"]}
                rows={data.funnel.map((f) => [
                  f.step,
                  fmt(f.count),
                  f.conversionFromPrev == null ? "—" : `${f.conversionFromPrev}%`,
                ])}
              />
            </Card>

            <Card className="flex flex-col gap-3 overflow-hidden p-0">
              <div className="border-hairline border-b px-4 py-3">
                <h3 className="text-ink text-sm font-extrabold">Snapshot</h3>
              </div>
              <DataTable
                columns={["Metric", "Value"]}
                rows={[
                  ["Google linked", fmt(data.users.withGoogle)],
                  ["Password accounts", fmt(data.users.withPassword)],
                  ["Onboarded", fmt(data.users.onboarded)],
                  ["With progress", fmt(data.users.withProgress)],
                  ["Total XP", fmt(data.activity.totalXp)],
                  ["Avg streak", String(data.activity.avgStreak)],
                  ["PvP games", fmt(data.games.total)],
                  ["Games finished", fmt(data.games.over)],
                  ["Waiting / active", `${data.games.waiting} / ${data.games.active}`],
                ]}
              />
            </Card>
          </div>
        </div>
      )}

      {tab === "events" && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-3 lg:grid-cols-2">
            <ChartCard title="Events · 30 days">
              <LineArea
                data={eventsChart}
                dataKey="count"
                color={theme.accent}
                theme={theme}
              />
            </ChartCard>
            <ChartCard title="Top events">
              {eventBars.length === 0 ? (
                <Empty>No events yet.</Empty>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={eventBars} layout="vertical" margin={{ left: 8, right: 8 }}>
                      <CartesianGrid
                        stroke={theme.hairline}
                        strokeDasharray="3 3"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{ fontSize: 10, fill: theme.inkMuted, fontFamily: theme.font }}
                        axisLine={{ stroke: theme.hairline }}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={110}
                        tick={{ fontSize: 9, fill: theme.inkMuted, fontFamily: theme.font }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        cursor={{ fill: theme.surfaceSunken, opacity: 0.7 }}
                        content={<ChartTooltip theme={theme} />}
                      />
                      <Bar
                        dataKey="count"
                        fill={theme.brand}
                        radius={[0, 6, 6, 0]}
                        activeBar={{ fill: theme.brandSoft }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </ChartCard>
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-hairline border-b px-4 py-3">
              <h3 className="text-ink text-sm font-extrabold">Event breakdown</h3>
              <p className="text-ink-500 text-[11px] font-semibold">
                Includes opt-out gaps for client-only events
              </p>
            </div>
            <DataTable
              columns={["Event", "Count", "Unique users", "Last seen"]}
              rows={data.events.map((e) => [
                e.name,
                fmt(e.count),
                fmt(e.uniqueUsers),
                e.lastAt ? formatWhen(e.lastAt) : "—",
              ])}
              empty="No events recorded."
            />
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-hairline border-b px-4 py-3">
              <h3 className="text-ink text-sm font-extrabold">Live stream</h3>
              <p className="text-ink-500 text-[11px] font-semibold">Latest 50 events</p>
            </div>
            <DataTable
              columns={["Time", "Event", "Path", "User"]}
              rows={data.recentEvents.map((e) => [
                formatWhen(e.createdAt),
                e.name,
                e.pathname ?? "—",
                e.userId ? shortId(e.userId) : "anon",
              ])}
              empty="No recent events."
              mono
            />
          </Card>
        </div>
      )}

      {tab === "lessons" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Catalog" value={data.lessons.catalogSize} />
            <Stat label="Progress rows" value={data.lessons.records} />
            <Stat label="Attempts" value={data.lessons.totalAttempts} />
            <Stat label="Mastered rows" value={data.lessons.mastered} />
          </div>
          <Card className="overflow-hidden p-0">
            <div className="border-hairline border-b px-4 py-3">
              <h3 className="text-ink text-sm font-extrabold">Top lessons</h3>
              <p className="text-ink-500 text-[11px] font-semibold">
                Ranked by attempts · avg mastery as %
              </p>
            </div>
            <DataTable
              columns={["Lesson", "Learners", "Attempts", "Mastered", "Avg mastery"]}
              rows={data.topLessons.map((l) => [
                l.title,
                fmt(l.learners),
                fmt(l.attempts),
                fmt(l.mastered),
                `${l.avgMastery}%`,
              ])}
              empty="No lesson activity yet."
            />
          </Card>
        </div>
      )}

      {tab === "users" && (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="Total" value={data.users.total} />
            <Stat label="Google" value={data.users.withGoogle} />
            <Stat label="Password" value={data.users.withPassword} />
            <Stat label="Onboarded" value={data.users.onboarded} />
          </div>

          <Card className="overflow-hidden p-0">
            <div className="border-hairline border-b px-4 py-3">
              <h3 className="text-ink text-sm font-extrabold">Top learners</h3>
              <p className="text-ink-500 text-[11px] font-semibold">By XP</p>
            </div>
            <DataTable
              columns={["Name", "Email", "XP", "Streak", "Lessons"]}
              rows={data.topLearners.map((u) => [
                u.name,
                u.email,
                fmt(u.xp),
                fmt(u.streak),
                fmt(u.lessonsTouched),
              ])}
              empty="No progress yet."
            />
          </Card>

          <Card className="overflow-hidden p-0">
            <div className="border-hairline border-b px-4 py-3">
              <h3 className="text-ink text-sm font-extrabold">Recent users</h3>
              <p className="text-ink-500 text-[11px] font-semibold">Newest accounts first</p>
            </div>
            <DataTable
              columns={["Joined", "Name", "Email", "Auth", "Role", "Onboarded", "XP"]}
              rows={data.recentUsers.map((u) => [
                formatWhen(u.createdAt),
                u.name,
                u.email,
                u.auth,
                u.role,
                u.onboarded ? "yes" : "no",
                fmt(u.xp),
              ])}
              empty="No users yet."
              mono
            />
          </Card>
        </div>
      )}
    </section>
  );
}

function ChartCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="flex flex-col gap-2 p-4">
      <h3 className="text-ink text-sm font-extrabold">{title}</h3>
      {children}
    </Card>
  );
}

function LineArea({
  data,
  dataKey,
  color,
  secondaryKey,
  secondaryColor,
  theme,
}: {
  data: { label: string; [k: string]: string | number }[];
  dataKey: string;
  color: string;
  secondaryKey?: string;
  secondaryColor?: string;
  theme: ChartTheme;
}) {
  if (data.every((d) => Number(d[dataKey] ?? 0) === 0) && !secondaryKey) {
    return <Empty>No data in this window.</Empty>;
  }
  const gradId = `cs-grad-${dataKey}`;
  return (
    <div className="h-52 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.32} />
              <stop offset="100%" stopColor={color} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={theme.hairline} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: theme.inkMuted, fontFamily: theme.font }}
            axisLine={{ stroke: theme.hairline }}
            tickLine={false}
            interval="preserveStartEnd"
            minTickGap={24}
          />
          <YAxis
            tick={{ fontSize: 10, fill: theme.inkMuted, fontFamily: theme.font }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: theme.hairline, strokeWidth: 1 }}
            content={<ChartTooltip theme={theme} />}
          />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={`url(#${gradId})`}
            strokeWidth={2.25}
            dot={false}
            activeDot={{ r: 4, stroke: theme.surfaceCard, strokeWidth: 2, fill: color }}
          />
          {secondaryKey ? (
            <Area
              type="monotone"
              dataKey={secondaryKey}
              stroke={secondaryColor ?? theme.inkFaint}
              fill="transparent"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              dot={false}
            />
          ) : null}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  payload,
  label,
  theme,
}: {
  active?: boolean;
  payload?: { name?: string; value?: number | string; color?: string }[];
  label?: string | number;
  theme: ChartTheme;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      style={{
        background: theme.surfaceCard,
        border: `1px solid ${theme.hairline}`,
        borderRadius: theme.radius,
        boxShadow: "var(--shadow-card)",
        color: theme.ink,
        fontFamily: theme.font,
        fontSize: 12,
        fontWeight: 600,
        padding: "8px 10px",
        minWidth: 120,
      }}
    >
      {label != null && label !== "" ? (
        <div style={{ color: theme.inkMuted, marginBottom: 4, fontWeight: 700 }}>{label}</div>
      ) : null}
      <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
        {payload.map((p, i) => (
          <li
            key={i}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: i ? 4 : 0,
            }}
          >
            <span
              aria-hidden
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                background: p.color ?? theme.brand,
                flexShrink: 0,
              }}
            />
            <span style={{ color: theme.inkMuted }}>{p.name}</span>
            <span style={{ marginLeft: "auto", fontVariantNumeric: "tabular-nums" }}>
              {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({
  columns,
  rows,
  empty,
  mono,
}: {
  columns: string[];
  rows: string[][];
  empty?: string;
  mono?: boolean;
}) {
  if (rows.length === 0) {
    return <Empty>{empty ?? "No rows."}</Empty>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[480px] border-collapse text-left text-xs">
        <thead>
          <tr className="bg-surface-sunken/80">
            {columns.map((c) => (
              <th
                key={c}
                className="text-ink-500 border-hairline border-b px-3 py-2 font-extrabold tracking-wide uppercase"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="hover:bg-surface-sunken/40 odd:bg-surface-card">
              {row.map((cell, j) => (
                <td
                  key={j}
                  className={cn(
                    "text-ink border-hairline border-b px-3 py-2 font-semibold tabular-nums",
                    j === 0 && "font-bold",
                    mono && "font-mono text-[11px]",
                  )}
                >
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="rounded-card border-hairline bg-surface-card border p-3 text-center">
      <div className="text-ink text-xl font-extrabold tabular-nums">{fmt(value)}</div>
      <div className="text-ink-500 text-[10px] font-semibold">{label}</div>
      {hint ? <div className="text-ink-300 mt-0.5 text-[9px] font-semibold">{hint}</div> : null}
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-ink-500 px-4 py-8 text-center text-xs font-semibold">{children}</p>
  );
}

function fmt(n: number): string {
  return n.toLocaleString();
}

function shortDay(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${m}/${d}`;
}

function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

function formatWhen(ms: number): string {
  try {
    return new Date(ms).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}
