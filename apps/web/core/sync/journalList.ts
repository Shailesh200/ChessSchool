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

/**
 * Reads of the journal list overlap: the page read can finish after a later read
 * (a pull wrote the saved note, or the owner became known). Only the latest read
 * may be shown. An older empty result must not wipe it.
 */
export function journalReadGeneration(): {
  start: () => number;
  isCurrent: (ticket: number) => boolean;
} {
  let current = 0;
  return {
    start() {
      current += 1;
      return current;
    },
    isCurrent(ticket: number) {
      return ticket === current;
    },
  };
}
