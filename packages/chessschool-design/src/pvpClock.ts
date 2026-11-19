/**
 * Clocks for "challenge a friend" games. The server keeps the truth (each side's time and when the
 * current turn started) and settles timeouts; the apps use the same maths to count down between polls.
 *
 * - Live games ("10m", "30m", "1h"): each side has that much time in total; only the side to move's clock runs.
 *   A side that has not made its first move within FIRST_MOVE_MS calls the game off ("aborted", no result).
 * - "1d": every move must be made within a day of the last one.
 * - "none": no clock; the game closes ("aborted") after IDLE_MS without a move.
 * - The friend must join within JOIN_MS of the link being made, whatever the clock.
 */
export type TimeControl = "10m" | "30m" | "1h" | "1d" | "none";
export const TIME_CONTROLS: readonly TimeControl[] = ["10m", "30m", "1h", "1d", "none"];
export const isTimeControl = (v: unknown): v is TimeControl => TIME_CONTROLS.includes(v as TimeControl);

export const JOIN_MS = 5 * 60_000;
export const FIRST_MOVE_MS = 60_000;
export const DAY_MS = 24 * 60 * 60_000;
export const IDLE_MS = 7 * DAY_MS;

const LIVE: Partial<Record<TimeControl, number>> = { "10m": 10 * 60_000, "30m": 30 * 60_000, "1h": 60 * 60_000 };
export const isLive = (tc: TimeControl) => LIVE[tc] !== undefined;
/** Each side's starting time for a live game (null for "1d" and "none"). */
export const baseMs = (tc: TimeControl): number | null => LIVE[tc] ?? null;

export type Side = "w" | "b";
/** What the server stores for a running game. `whiteMs`/`blackMs`: time left before the current turn (live games). */
export type ClockData = { tc: TimeControl; whiteMs: number | null; blackMs: number | null; turnStartedAt: number; plies: number };
export type ClockView = {
  /** Time left now for each side (live), or for the side to move ("1d"); null where there is no clock. */
  white: number | null;
  black: number | null;
  running: Side | null;
  /** The side whose time ran out, if any. */
  flagged: Side | null;
  /** Called off: no first move in time (live) or idle too long ("none"). */
  aborted: boolean;
};

const toMove = (plies: number): Side => (plies % 2 ? "b" : "w");

export function clockAt(d: ClockData, now: number): ClockView {
  const side = toMove(d.plies);
  const elapsed = Math.max(0, now - d.turnStartedAt);
  if (isLive(d.tc)) {
    const left = (s: Side) => {
      const stored = (s === "w" ? d.whiteMs : d.blackMs) ?? baseMs(d.tc)!;
      return s === side ? Math.max(0, stored - elapsed) : stored;
    };
    const white = left("w");
    const black = left("b");
    const firstMoveLate = d.plies < 2 && elapsed > FIRST_MOVE_MS;
    const out = (side === "w" ? white : black) <= 0;
    return { white, black, running: side, flagged: !firstMoveLate && out ? side : null, aborted: firstMoveLate };
  }
  if (d.tc === "1d") {
    const left = Math.max(0, DAY_MS - elapsed);
    return { white: side === "w" ? left : null, black: side === "b" ? left : null, running: side, flagged: left <= 0 ? side : null, aborted: false };
  }
  return { white: null, black: null, running: null, flagged: null, aborted: elapsed > IDLE_MS };
}

/** The stored clock after the side to move plays at `now` (call only when clockAt shows no flag or abort). */
export function clockAfterMove(d: ClockData, now: number): ClockData {
  const view = clockAt(d, now);
  const side = toMove(d.plies);
  if (!isLive(d.tc)) return { ...d, turnStartedAt: now, plies: d.plies + 1 };
  return { ...d, whiteMs: side === "w" ? view.white : d.whiteMs, blackMs: side === "b" ? view.black : d.blackMs, turnStartedAt: now, plies: d.plies + 1 };
}

/** What the clocks show `spentMs` after the server's view: only the running side's time goes down. */
export function clockSince(view: Pick<ClockView, "white" | "black" | "running">, spentMs: number): { white: number | null; black: number | null } {
  const tick = (side: Side, v: number | null) => (v === null ? null : view.running === side ? Math.max(0, v - Math.max(0, spentMs)) : v);
  return { white: tick("w", view.white), black: tick("b", view.black) };
}

/** "9:58", or "1:02:05" past an hour, or "23h" for a day clock. */
export function formatClock(ms: number, tc: TimeControl): string {
  const s = Math.ceil(ms / 1000);
  if (tc === "1d" && s >= 3600) return `${Math.floor(s / 3600)}h`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${m}:${ss}`;
}
