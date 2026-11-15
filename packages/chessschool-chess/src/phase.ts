/** Game phase used by the mistake model (shared by the Lichess build script and the bots). */
export type Phase = "opening" | "middlegame" | "endgame";

const NON_PAWN: Record<string, number> = { n: 3, b: 3, r: 5, q: 9 };

/** `placement` is the first FEN field; `ply` counts half-moves already played. */
export function phaseOf(placement: string, ply: number): Phase {
  let material = 0;
  for (const ch of placement) material += NON_PAWN[ch.toLowerCase()] ?? 0;
  // Both sides together: queens off with a rook and a minor each (16) or less is an endgame.
  if (material <= 26) return "endgame";
  return ply < 20 ? "opening" : "middlegame";
}

/** Rating bands by the mover's Elo: 400, 600, ... 2400 (2400 means 2400 and up). */
export const BANDS = [400, 600, 800, 1000, 1200, 1400, 1600, 1800, 2000, 2200, 2400] as const;
export const bandOf = (elo: number) => BANDS[Math.max(0, Math.min(BANDS.length - 1, Math.floor((elo - 400) / 200)))];

/** Centipawn-loss bucket lower edges; the last bucket is open-ended. */
export const CP_BUCKETS = [0, 10, 25, 50, 100, 200, 300, 500, 1000] as const;
