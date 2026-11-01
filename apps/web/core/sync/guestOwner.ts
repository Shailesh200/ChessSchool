/**
 * Who the guest copy on this device belongs to. A session-expiry 401 signs the user
 * out but keeps the edit in the persisted store as guest progress; this records whose
 * it is. pullProgress merges it only when that same user signs in, and drops it when a
 * different user does. No tag means a plain guest: it merges as before.
 */
const KEY = "chessschool.guestOwner";

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
