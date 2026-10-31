/**
 * Who the journal list may be read for.
 * Null until persisted auth has loaded, so a first paint does not freeze an empty list
 * for the wrong owner.
 */
export function journalListOwner(
  ready: boolean,
  authed: boolean | null,
  userId: string | null,
): string | null {
  if (!ready) return null;
  if (authed === true) return userId;
  if (authed === false) return "guest";
  return null;
}
