/**
 * Whether the ChessSchool API answers, shared by every screen of one app.
 *
 * The banner used to come from a single health request per mounted screen: one slow cold start or one dropped
 * request on a mobile network showed "servers aren't answering", and "Try again" (a second request) then worked.
 * Now one watcher serves all screens, a probe retries quietly with backoff before calling the API down, any
 * successful API call marks it up again, and while it is down it re-checks on its own.
 */
export type ApiWatch = {
  /** True until a full probe (with its retries) has failed. */
  up: () => boolean;
  subscribe: (fn: () => void) => () => void;
  /** Probes now (joins a probe already running). */
  check: () => Promise<boolean>;
  /** Any successful API response: the API is up. */
  reportOk: () => void;
  /** A request failed without an answer (network error or timeout): probe before deciding anything. */
  reportFail: () => void;
  stop: () => void;
};

export type ApiWatchOptions = {
  probe: () => Promise<unknown>;
  /** Waits between probe attempts; the API is down only when every attempt failed. */
  backoffMs?: readonly number[];
  /** While down, how often to look again. */
  recheckMs?: number;
  sleep?: (ms: number) => Promise<void>;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (t: unknown) => void;
};

export const PROBE_BACKOFF_MS = [1_500, 4_000] as const;

export function createApiWatch({
  probe,
  backoffMs = PROBE_BACKOFF_MS,
  recheckMs = 30_000,
  sleep = (ms) => new Promise((r) => setTimeout(r, ms)),
  setTimer = (fn, ms) => setTimeout(fn, ms),
  clearTimer = (t) => clearTimeout(t as ReturnType<typeof setTimeout>),
}: ApiWatchOptions): ApiWatch {
  let up = true;
  let running: Promise<boolean> | null = null;
  let timer: unknown = null;
  const listeners = new Set<() => void>();

  const set = (next: boolean) => {
    if (timer) clearTimer(timer);
    timer = next ? null : setTimer(() => void check(), recheckMs);
    if (next === up) return;
    up = next;
    for (const fn of listeners) fn();
  };

  async function attempt(): Promise<boolean> {
    for (let i = 0; i <= backoffMs.length; i++) {
      try {
        await probe();
        return true;
      } catch {
        if (i < backoffMs.length) await sleep(backoffMs[i]!);
      }
    }
    return false;
  }

  function check(): Promise<boolean> {
    if (!running) {
      running = attempt().then((ok) => {
        running = null;
        set(ok);
        return ok;
      });
    }
    return running;
  }

  return {
    up: () => up,
    subscribe: (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    check,
    reportOk: () => set(true),
    reportFail: () => void check(),
    stop: () => {
      if (timer) clearTimer(timer);
      timer = null;
    },
  };
}

/** Methods that are safe to send twice (the server dedupes or replaces): retried quietly after a dropped request. */
export const RETRY_METHODS = new Set(["GET", "PUT"]);
/** Gateway errors from a cold or redeploying serverless function: worth one more try. */
export const isRetryableStatus = (status: number) => status === 0 || status === 502 || status === 503 || status === 504;
