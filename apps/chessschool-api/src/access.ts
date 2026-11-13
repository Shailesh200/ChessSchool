/** A guest may have at most this many path classes unlocked or started. */
export const GUEST_CLASS_LIMIT = 3;
/** Stable client code for the enrol / log-in sheet. */
export const GUEST_LIMIT_CODE = "GUEST_CLASS_LIMIT";

export type LockedReason = "progress" | "guest";

export type PathNodeAccess = {
  id: string;
  state: "done" | "current" | "locked";
  lockedReason?: LockedReason;
  /** The lesson script may be fetched. Guests may start any of the first three classes. */
  playable: boolean;
};

export type CourseAccess = {
  guest: boolean;
  /** True once the next class stays locked because the guest allowance is used up. */
  guestLimitReached: boolean;
  path: PathNodeAccess[];
};

/** Not signed in, or an account marked guest. */
export function isGuestAccount(user: { kind: string } | null): boolean {
  return !user || user.kind === "guest";
}

const doneDay = (day: string | undefined) => typeof day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(day);

/**
 * Sequential unlock: the completed prefix is done, the first unfinished class is current,
 * and every class after that is locked. Guests stop at {@link GUEST_CLASS_LIMIT}.
 * The same completed map always produces the same path (repeat completion is a no-op).
 */
/** `path` is the lesson order from the course tables. */
export function courseAccess(completed: Record<string, string | undefined>, guest: boolean, path: readonly { id: string }[]): CourseAccess {
  let firstOpen = -1;
  for (let i = 0; i < path.length; i++) {
    if (!doneDay(completed[path[i]!.id])) {
      firstOpen = i;
      break;
    }
  }
  const guestLimitReached = guest && firstOpen >= GUEST_CLASS_LIMIT;
  const nodes: PathNodeAccess[] = path.map((n, index) => {
    if (doneDay(completed[n.id])) return { id: n.id, state: "done", playable: true };
    if (guest && index >= GUEST_CLASS_LIMIT) return { id: n.id, state: "locked", lockedReason: "guest", playable: false };
    if (index === firstOpen) return { id: n.id, state: "current", playable: true };
    return { id: n.id, state: "locked", lockedReason: "progress", playable: guest && index < GUEST_CLASS_LIMIT };
  });
  return { guest, guestLimitReached, path: nodes };
}

/** True when a guest payload tries to record a class past the allowance. */
export function guestProgressOverreach(completed: Record<string, string | undefined> | undefined, path: readonly { id: string }[]): boolean {
  if (!completed) return false;
  return path.some((n, index) => index >= GUEST_CLASS_LIMIT && doneDay(completed[n.id]));
}
