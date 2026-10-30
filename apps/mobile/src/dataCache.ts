/** In-memory TTL cache for API responses (stale-while-revalidate). */

type Entry = { data: unknown; at: number };

const store = new Map<string, Entry>();

/**
 * Bumped by cacheClear(), which wipeUserData() runs on logout, a 401 and delete. A fetch captures it
 * before it starts and hands it back to cacheSet(), so a reply that lands after the wipe is dropped
 * instead of putting the old user's payload back into the cache.
 */
let generation = 0;

export function cacheGeneration(): number {
  return generation;
}

export function cachePeek<T>(key: string): T | null {
  const e = store.get(key);
  return e ? (e.data as T) : null;
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const e = store.get(key);
  if (!e || Date.now() - e.at > maxAgeMs) return null;
  return e.data as T;
}

/**
 * Store a payload. Pass the cacheGeneration() read BEFORE the fetch started: the write is dropped (and
 * false returned) when a wipe has run since. Returns true when the entry was stored.
 */
export function cacheSet<T>(key: string, data: T, startedAt?: number): boolean {
  if (startedAt !== undefined && startedAt !== generation) return false;
  store.set(key, { data, at: Date.now() });
  return true;
}

export function cacheAge(key: string): number {
  const e = store.get(key);
  return e ? Date.now() - e.at : Infinity;
}

export function cacheInvalidate(key: string): void {
  store.delete(key);
}

export function cacheInvalidatePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}

/** Drop every entry: the cached payloads belong to whoever was signed in (identity change). */
export function cacheClear(): void {
  generation += 1;
  store.clear();
}
