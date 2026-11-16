import type { RatingPoint } from "./api";

export const RATING_STEP = 100;
/** The next hundred above `rating` (900 → 1000, 950 → 1000). */
export const nextRatingMilestone = (rating: number) => Math.floor(rating / RATING_STEP) * RATING_STEP + RATING_STEP;

export type RatingChart = { path: string; dots: { x: number; y: number }[]; min: number; max: number; lines: { y: number; value: number }[] };

/**
 * One line through the rating after each result, scaled into a `width` x `height` box.
 * The y range snaps to hundreds, and `lines` marks every hundred in range (the milestones).
 */
export function ratingChart(points: readonly RatingPoint[], width: number, height: number, pad = 8): RatingChart {
  const values = points.map((p) => p.rating);
  const min = Math.floor(Math.min(...values, Infinity) / RATING_STEP) * RATING_STEP;
  const max = Math.max(Math.ceil(Math.max(...values, -Infinity) / RATING_STEP) * RATING_STEP, min + RATING_STEP);
  if (!values.length) return { path: "", dots: [], min: 0, max: 0, lines: [] };
  const round = (n: number) => Math.round(n * 10) / 10;
  const x = (i: number) => round(values.length === 1 ? width / 2 : pad + (i * (width - 2 * pad)) / (values.length - 1));
  const y = (v: number) => round(height - pad - ((v - min) / (max - min)) * (height - 2 * pad));
  const dots = values.map((v, i) => ({ x: x(i), y: y(v) }));
  const lines: RatingChart["lines"] = [];
  for (let v = min; v <= max; v += RATING_STEP) lines.push({ y: y(v), value: v });
  return { path: dots.map((d, i) => `${i ? "L" : "M"}${d.x} ${d.y}`).join(" "), dots, min, max, lines };
}
