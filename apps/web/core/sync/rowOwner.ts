import { useSession } from "@/core/store/session.store";
import { getGuestOwner, getSignedInMarker } from "@/core/sync/guestOwner";

/**
 * Who a local journal entry, saved game or review belongs to.
 *
 * Every row written to the local database carries `owner`, the user id of whoever was
 * signed in when it was queued. A row is read, pushed or kept only for its own owner.
 * Fail closed: a row whose owner is not the current user's is never shown and never sent,
 * and one with no tag is not trusted (see legacyOwner).
 *
 * ROW_GUEST marks a row made while signed out. It is shown to a signed-out visitor, and a
 * new (empty) account absorbs it at its first pull, like the guest progress; for any other
 * user it is dropped. An unknown owner is "?" (GUEST_OWNER_UNKNOWN): it matches no user.
 */
export const ROW_GUEST = "guest";
export const ROW_OWNER_UNKNOWN = "?";

/** The user id of the session that is signed in right now, or null. */
export function sessionUserId(): string | null {
  const s = useSession.getState();
  return s.authed === true && s.user?.id ? s.user.id : null;
}

/** The owner a row queued now gets. */
export function rowOwnerNow(): string {
  const id = sessionUserId();
  if (id) return id;
  const s = useSession.getState();
  // A session expiry kept the device's copy for its user: what is saved now is still theirs.
  const kept = getGuestOwner();
  if (kept) return kept;
  const marker = getSignedInMarker();
  if (marker) return marker;
  // Signed in or still checking, but the id is not known: matches nobody.
  if (s.authed !== false) return ROW_OWNER_UNKNOWN;
  return ROW_GUEST;
}

/**
 * Owner of a row written before rows were tagged. The device's last known user (the kept
 * copy's owner, or the user of the last successful pull) is the only one it can be, and no
 * user at all means a guest's.
 */
export function legacyOwner(): string {
  return getGuestOwner() ?? getSignedInMarker() ?? ROW_GUEST;
}

export type Owned = { owner?: string };

export function ownerOf(row: Owned, legacy: string): string {
  return typeof row.owner === "string" && row.owner ? row.owner : legacy;
}

/** The rows that belong to `owner`. */
export function ownedBy<T extends Owned>(rows: T[], owner: string): T[] {
  const legacy = legacyOwner();
  return rows.filter((r) => ownerOf(r, legacy) === owner);
}

/** The row without its tag: it never goes into a request body. */
export function withoutOwner<T extends Owned>(row: T): Omit<T, "owner"> {
  const { owner: _o, ...rest } = row;
  return rest;
}

export type Reconcile<T extends Owned> = { keep: T[]; drop: T[] };

/**
 * `userId` signed in: split the rows into the ones that stay (theirs, tagged or legacy, and
 * a guest's when `adoptGuest`) and the ones that go (anyone else's, an unknown owner's, a
 * guest's when not adopted). The rows that stay come back tagged with `userId`.
 */
export function reconcileRows<T extends Owned & { id: string }>(
  rows: T[],
  userId: string,
  adoptGuest: boolean,
  legacy: string,
): Reconcile<T> {
  const keep: T[] = [];
  const drop: T[] = [];
  for (const r of rows) {
    const o = ownerOf(r, legacy);
    if (o === userId || (adoptGuest && o === ROW_GUEST))
      keep.push({ ...r, owner: userId });
    else drop.push(r);
  }
  return { keep, drop };
}
