/** Notify ProgressSync to debounce-push after Dexie journal writes. */
const listeners = new Set<() => void>();

export function onSyncTrigger(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function syncTrigger(): void {
  for (const fn of listeners) fn();
}
