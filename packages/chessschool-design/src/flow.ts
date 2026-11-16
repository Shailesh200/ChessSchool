import type { SoundCue } from "./mascot";
import { MATE_TRIES } from "./progress";

/**
 * Lesson flow: the "in a row" combo, the perfect-lesson check and the end-of-lesson summary.
 * A step counts once it is solved; it is clean when solved with no miss and no hint.
 */
export type Tally = { solved: number; clean: number; combo: number; best: number; startedAt: number };
export const startTally = (now: number): Tally => ({ solved: 0, clean: 0, combo: 0, best: 0, startedAt: now });

export function tallyStep(t: Tally, clean: boolean): Tally {
  const combo = clean ? t.combo + 1 : 0;
  return { ...t, solved: t.solved + 1, clean: t.clean + (clean ? 1 : 0), combo, best: Math.max(t.best, combo) };
}
/** A miss ends the run. */
export const tallyMiss = (t: Tally): Tally => (t.combo ? { ...t, combo: 0 } : t);

/** The runner fields the tally reads (a lesson-runner state from @chessschool/chess). */
type RunnerLike = { status: string; misses: number; showHint: boolean };
/**
 * The tally after one runner update. `stepMisses` is the miss count when the current step opened:
 * a step solved with no miss and no hint since then is clean; a miss ends the run at once.
 */
export function tallyAfter(t: Tally, prev: RunnerLike, next: RunnerLike, stepMisses: number): Tally {
  if (next.status === "ready" && prev.status === "working") return tallyStep(t, next.misses === stepMisses && !prev.showHint && !next.showHint);
  return next.misses > prev.misses ? tallyMiss(t) : t;
}

/** The meter shows from this many in a row. */
export const COMBO_MIN = 3;
/** Runs that get the bigger cheer. */
export const isComboBeat = (n: number) => n === COMBO_MIN || (n >= 5 && n % 5 === 0);
export const isPerfect = (t: Tally) => t.solved > 0 && t.clean === t.solved;
export const accuracy = (t: Tally) => (t.solved ? Math.round((100 * t.clean) / t.solved) : 100);
export const elapsedSeconds = (t: Tally, now: number) => Math.max(0, Math.round((now - t.startedAt) / 1000));

/** One sound and haptic per lesson-flow event (both apps play it through `cue`, which respects the prefs). */
export const FLOW_CUES = { combo: "success", perfect: "level-up", summary: "stamp", milestone: "level-up", repair: "success" } as const satisfies Record<string, SoundCue>;

/* ---------- mate of the day share ---------- */

export const MATE_URL = "https://chess-school.in/mate";
/** One row per try: 🟩 right move, 🟥 wrong move, ⬜ not played. Unused tries are rows of ⬜. */
export function mateGrid(tries: readonly (readonly boolean[])[]): string {
  const rows = Array.from({ length: MATE_TRIES }, (_, i) => {
    const t = tries[i] ?? [];
    return [0, 1].map((k) => (t[k] === true ? "🟩" : t[k] === false ? "🟥" : "⬜")).join("");
  });
  return rows.join("\n");
}

/** The share text: title, the grid and the link. No moves, so it never spoils the puzzle. */
export const mateShareText = (day: string, tries: readonly (readonly boolean[])[], title: string, result: string) =>
  `${title}\n${result}\n${mateGrid(tries)}\n${MATE_URL}/${day}`;
