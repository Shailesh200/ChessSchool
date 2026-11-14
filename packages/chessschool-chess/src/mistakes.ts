import raw from "./data/mistakes.json";
import { BANDS, CP_BUCKETS, type Phase } from "./phase";

/** How people at each Lichess rating band lose centipawns (built by scripts/build-mistakes.mjs). */
export type MistakeModel = {
  month: string;
  gamesKept: number;
  buckets: readonly number[];
  /** [phase] -> [quiet, tactical] -> move counts per centipawn-loss bucket. */
  bands: Record<string, { moves: number; rates: { inaccuracy: number; mistake: number; blunder: number }; counts: Record<Phase, [number[], number[]]> }>;
};
export const MISTAKES = raw as unknown as MistakeModel;

/** Too few moves in a cell to trust: use the whole band instead. */
const MIN_CELL = 200;

function countsFor(band: number, phase: Phase, tactical: boolean): number[] {
  const b = MISTAKES.bands[band];
  const cell = b.counts[phase][tactical ? 1 : 0];
  if (cell.reduce((a, c) => a + c, 0) >= MIN_CELL) return cell;
  return CP_BUCKETS.map((_, i) => Object.values(b.counts).reduce((s, pair) => s + pair[0][i] + pair[1][i], 0));
}

/**
 * A centipawn loss a player of `rating` might accept here, drawn from real games. Ratings between
 * bands pick the nearer band more often; the last bucket (1000+) returns 1000, the model's cap.
 */
export function sampleLoss(rating: number, phase: Phase, tactical: boolean, rand: () => number): number {
  const pos = Math.max(0, Math.min(BANDS.length - 1, (rating - BANDS[0]) / 200));
  const lo = Math.floor(pos);
  const band = BANDS[rand() < pos - lo ? lo + 1 : lo];
  const counts = countsFor(band, phase, tactical);
  let pick = rand() * counts.reduce((a, c) => a + c, 0);
  let i = 0;
  while (i < counts.length - 1 && pick >= counts[i]) pick -= counts[i++];
  const from = CP_BUCKETS[i];
  const to = CP_BUCKETS[i + 1] ?? from;
  return from + rand() * (to - from);
}
