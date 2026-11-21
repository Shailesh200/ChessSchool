"use client";

import { useState } from "react";

type Point = { day: string; n: number };

const short = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
const long = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
/** A rounded top for the y-axis: 1, 2, 5, 10, 20, 50… at or above the peak. */
const niceMax = (peak: number) => {
  if (peak <= 4) return Math.max(1, peak);
  const step = 10 ** Math.floor(Math.log10(peak));
  return [1, 2, 5, 10].map((m) => m * step).find((v) => v >= peak) ?? peak;
};

/** Every day from `days` ago to today (UTC), with gaps as zero, so quiet days show as gaps rather than wider bars. */
export function fillDays(points: Point[], days: number, nowMs = Date.now()): Point[] {
  const by = new Map(points.map((p) => [p.day, p.n]));
  return Array.from({ length: days }, (_, i) => {
    const day = new Date(nowMs - (days - 1 - i) * 86_400_000)
      .toISOString()
      .slice(0, 10);
    return { day, n: by.get(day) ?? 0 };
  });
}

/** Daily bars with a y-axis (0, half, top), date ticks under the bars and a tooltip on hover or focus. */
export function BarChart({
  points,
  label,
  unit,
}: {
  points: Point[];
  label: string;
  unit: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...points.map((p) => p.n)));
  // About six date labels whatever the range.
  const every = Math.max(1, Math.ceil(points.length / 6));
  const total = points.reduce((s, p) => s + p.n, 0);
  const shown = hover === null ? null : points[hover];
  return (
    <figure
      className="chart"
      aria-label={`${label}: ${total} ${unit} in ${points.length} days`}
    >
      <div className="chart-y" aria-hidden>
        <span>{top}</span>
        <span>{top / 2 === Math.floor(top / 2) ? top / 2 : ""}</span>
        <span>0</span>
      </div>
      <div className="chart-area" onMouseLeave={() => setHover(null)}>
        <div className="chart-grid" aria-hidden>
          <span />
          <span />
          <span />
        </div>
        <div className="chart-bars" role="list">
          {points.map((p, i) => (
            <button
              key={p.day}
              type="button"
              role="listitem"
              className={["chart-bar", p.n ? "" : "empty", hover === i ? "on" : ""].filter(Boolean).join(" ")}
              style={{ height: p.n ? `${Math.max(2, (p.n / top) * 100)}%` : "2px" }}
              aria-label={`${long(p.day)}: ${p.n} ${unit}`}
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          ))}
        </div>
        {shown ? (
          <div
            className="chart-tip"
            role="status"
            style={{ left: `${((hover! + 0.5) / points.length) * 100}%` }}
          >
            <strong>{shown.n.toLocaleString()}</strong> {unit}
            <span>{long(shown.day)}</span>
          </div>
        ) : null}
      </div>
      <span aria-hidden />
      <div className="chart-x" aria-hidden>
        {points.map((p, i) => (
          // The last day is always labelled; a regular tick too close to it is dropped so they don't overlap.
          <span key={p.day}>
            {i === points.length - 1 ||
            (i % every === 0 && points.length - 1 - i >= every / 2)
              ? short(p.day)
              : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
