/** In-memory TTL cache for API responses (stale-while-revalidate). */

type Entry = { data: unknown; at: number };

const store = new Map<string, Entry>();

export function cachePeek<T>(key: string): T | null {
  const e = store.get(key);
  return e ? (e.data as T) : null;
}

export function cacheGet<T>(key: string, maxAgeMs: number): T | null {
  const e = store.get(key);
  if (!e || Date.now() - e.at > maxAgeMs) return null;
  return e.data as T;
}

export function cacheSet<T>(key: string, data: T): void {
  store.set(key, { data, at: Date.now() });
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
