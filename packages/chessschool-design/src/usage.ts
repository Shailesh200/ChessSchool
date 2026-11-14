/** The only usage events the apps send. Nothing here carries a name, email or account id. */
export const USAGE_EVENTS = ["app_open", "lesson_start", "lesson_finish", "lesson_quit", "puzzle_solved", "puzzle_failed", "game_finished", "practice_finished"] as const;
export type UsageEventName = (typeof USAGE_EVENTS)[number];
export type UsageEvent = { name: UsageEventName; at: number; lesson?: string; step?: number; value?: number };
export type UsageBatch = { install: string; platform: "ios" | "android" | "web"; appVersion: string; events: UsageEvent[] };

const BATCH = 50;
const KEEP = 200;

/**
 * A small in-memory queue for anonymous usage events. Sends in batches a few seconds after the
 * last event; a failed batch goes back on the queue. Nothing is queued while `enabled()` is false.
 * shortcut: the queue is not persisted, so events from a session killed before a flush are lost; persist if numbers look low.
 */
export function createUsage(opts: {
  send: (batch: UsageBatch) => Promise<unknown>;
  install: () => string;
  platform: UsageBatch["platform"];
  appVersion: string;
  enabled: () => boolean;
  delayMs?: number;
  now?: () => number;
}) {
  let queue: UsageEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;

  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (sending || !queue.length) return;
    if (!opts.enabled()) return void (queue = []);
    const events = queue.splice(0, BATCH);
    sending = true;
    try {
      await opts.send({ install: opts.install(), platform: opts.platform, appVersion: opts.appVersion, events });
    } catch {
      queue = [...events, ...queue].slice(0, KEEP);
    } finally {
      sending = false;
    }
    if (queue.length) schedule();
  }

  function schedule() {
    if (!timer) timer = setTimeout(() => void flush(), opts.delayMs ?? 5000);
  }

  return {
    track(name: UsageEventName, extra: Omit<UsageEvent, "name" | "at"> = {}) {
      if (!opts.enabled()) return;
      queue.push({ name, at: (opts.now ?? Date.now)(), ...extra });
      if (queue.length > KEEP) queue = queue.slice(-KEEP);
      if (queue.length >= BATCH) void flush();
      else schedule();
    },
    flush,
    /** For tests. */
    pending: () => queue.length,
  };
}
