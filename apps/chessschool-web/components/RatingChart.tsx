"use client";

import { copy, nextRatingMilestone, ratingChart, type RatingPoint } from "@chessschool/design";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useApp } from "@/lib/state";
import { Card } from "./ui";

const W = 320;
const H = 140;

/** Profile: the playing rating after each counted result, from the server's history. */
export function RatingChart() {
  const { state } = useApp();
  const signedIn = Boolean(state.account);
  const child = state.activeChild;
  const games = state.ratings.player.games;
  const [points, setPoints] = useState<RatingPoint[] | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    let live = true;
    api
      .ratingHistory(child)
      .then((r) => live && setPoints(r.points))
      .catch(() => live && setPoints([]));
    return () => {
      live = false;
    };
  }, [signedIn, child, games]);

  const rating = state.ratings.player.rating;
  const best = state.ratings.best ?? rating;
  const chart = points?.length ? ratingChart(points, W, H, 12) : null;
  return (
    <Card className="rating-chart" aria-labelledby="rating-chart-title">
      <div className="rating-chart-head">
        <h2 id="rating-chart-title" className="card-title">
          {copy.ratingChart.title}
        </h2>
        <strong data-testid="rating-now">{rating}</strong>
      </div>
      {chart && points ? (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={copy.ratingChart.label(points[0].rating, points[points.length - 1].rating, points.length)} data-points={points.length}>
            {chart.lines.map((l) => (
              <g key={l.value}>
                <line x1={0} x2={W} y1={l.y} y2={l.y} className="rating-chart-grid" />
                <text x={2} y={l.y - 3} className="rating-chart-tick">
                  {l.value}
                </text>
              </g>
            ))}
            <path d={chart.path} className="rating-chart-line" />
            <circle cx={chart.dots[chart.dots.length - 1].x} cy={chart.dots[chart.dots.length - 1].y} r={5} className="rating-chart-dot" />
          </svg>
          {/* The same numbers for screen readers. */}
          <table className="sr-only">
            <caption>{copy.ratingChart.caption}</caption>
            <thead>
              <tr>
                <th scope="col">{copy.ratingChart.colResult}</th>
                <th scope="col">{copy.ratingChart.colDate}</th>
                <th scope="col">{copy.ratingChart.colRating}</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p, i) => (
                <tr key={`${p.at}-${i}`}>
                  <td>{i + 1}</td>
                  <td>{new Date(p.at).toLocaleDateString()}</td>
                  <td>{p.rating}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : (
        <p className="muted">{signedIn ? copy.ratingChart.empty : copy.ratingChart.signIn}</p>
      )}
      <p className="rating-chart-foot muted">
        <span>{copy.ratingChart.best(best)}</span>
        <span>{copy.ratingChart.next(nextRatingMilestone(rating))}</span>
      </p>
    </Card>
  );
}
