/**
 * Who the guest copy on this device belongs to. A session-expiry 401 signs the user
 * out but keeps the edit in the persisted store as guest progress; this records whose
 * it is. pullProgress merges it only when that same user signs in, and drops it when a
 * different user does. No tag means a plain guest (made while signed out): it merges as
 * before. A copy kept from a signed-in session whose user is not known is tagged with
 * GUEST_OWNER_UNKNOWN, which matches no user: it is dropped, whoever signs in. An explicit
 * logout wipes the store and clears the tag, so no kept copy or tag is left behind.
 *
 * The signed-in marker tells a kept copy from a real guest's when the session store no
 * longer says signed in (a cold start: the persisted session is gone or says signed out,
 * but the persisted progress is the user's). It is written when a pull succeeds (with the
 * user id) and cleared by an explicit logout or account deletion. A 401 while it is set
 * means the copy came from a signed-in session: it is tagged with the marker's owner
 * (GUEST_OWNER_UNKNOWN when there is none) and follows the same fail-closed rules. With
 * no marker the visitor is a real guest, and the copy merges into whoever signs in.
 * A successful pull for a user other than the marker's drops the store left on the device
 * first (no logout or 401 ran in between, so nothing else would): it is the marker's user's,
 * not this one's. The same user's marker keeps the store; no marker is a real guest.
 * A browser that was signed in before the marker existed has none until its next
 * successful pull: until then it is treated as a guest (a 401 in that one window cannot
 * be told apart from a guest's). Nothing is migrated from an older key: the (f)-era
 * `chessschool.guestProgressOwner` (mobile) was never shipped, (g) lands together with it.
 */
const KEY = "chessschool.guestOwner";
const SIGNED_IN_KEY = "chessschool.signedIn";

/** Kept from a signed-in session, owner not known. User ids are UUIDs, so this never matches one. */
export const GUEST_OWNER_UNKNOWN = "?";

export function getGuestOwner(): string | null {
  try {
    return localStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
}

export function setGuestOwner(userId: string): void {
  try {
    localStorage.setItem(KEY, userId);
  } catch {
    /* ignore */
  }
}

export function clearGuestOwner(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** A pull succeeded for this user: a later 401 is an expiry, not a guest's. */
export function markSignedIn(userId: string): void {
  try {
    localStorage.setItem(SIGNED_IN_KEY, userId || GUEST_OWNER_UNKNOWN);
  } catch {
    /* ignore */
  }
}

/** The user id of the last successful pull (GUEST_OWNER_UNKNOWN if none was stored), or null for a real guest. */
export function getSignedInMarker(): string | null {
  try {
    return localStorage.getItem(SIGNED_IN_KEY) || null;
  } catch {
    return null;
  }
}

export function clearSignedInMarker(): void {
  try {
    localStorage.removeItem(SIGNED_IN_KEY);
  } catch {
    /* ignore */
  }
}
