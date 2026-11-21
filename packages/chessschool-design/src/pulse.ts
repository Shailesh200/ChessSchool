/**
 * Product analytics through Pulse (a self-hosted Umami at pulse.shaileshjha.in), shared by the app and the website.
 *
 * Privacy rules, enforced here rather than at each call site:
 * - Only the event names below are sent; anything else is dropped.
 * - Property values must be numbers, booleans or short id-like strings ("bot-rex", "hi", "win").
 *   Free text, names and emails cannot pass `cleanProps` (spaces, "@" and long strings are refused).
 * - Nothing is sent while the learner has "Share anonymous usage" off, or when no website id is configured.
 * Events are queued and sent a few at a time after a short delay, off the UI path; failures are dropped.
 */

export const PULSE_EVENTS = [
  "onboarding_step",
  "onboarding_skip",
  "terms_accept",
  "language_pick",
  "first_lesson_start",
  "first_lesson_finish",
  "lesson_start",
  "lesson_complete",
  "puzzle_solved",
  "puzzle_failed",
  "bot_game_start",
  "bot_game_end",
  "challenge_create",
  "challenge_join",
  "challenge_finish",
  "signup",
  "login",
  "ai_hint",
  "share",
  "leaderboard_open",
  "settings_change",
] as const;
export type PulseEvent = (typeof PULSE_EVENTS)[number];
export type PulseProps = Record<string, string | number | boolean>;

const ID_VALUE = /^[A-Za-z0-9_.:-]{1,40}$/;
const KEY = /^[a-z][a-z0-9_]{0,23}$/;
/** Keys that could carry personal data are refused even when the value looks harmless. */
const BLOCKED_KEYS = /name|email|mail|phone|user|text|message|note|token|ip/;

export function cleanProps(props: Record<string, unknown> | undefined): PulseProps | undefined {
  if (!props) return undefined;
  const out: PulseProps = {};
  for (const [k, v] of Object.entries(props).slice(0, 10)) {
    if (!KEY.test(k) || BLOCKED_KEYS.test(k)) continue;
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 100) / 100;
    else if (typeof v === "string" && ID_VALUE.test(v)) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Path for a screen view with ids that could be personal (challenge / invite codes, share ids) blanked out. */
export function screenPath(path: string): string {
  const clean = path.split(/[?#]/)[0] || "/";
  return clean.replace(/^\/(c|i|s|join|certificate)\/[^/]+/, "/$1/:id").slice(0, 120);
}

export type PulseOptions = {
  websiteId: string | undefined | null;
  origin?: string;
  hostname: string;
  /** Sends one Umami payload; the app adds a User-Agent, the web uses keepalive. Errors are swallowed. */
  post: (url: string, body: string) => Promise<unknown>;
  enabled: () => boolean;
  language?: () => string;
  screen?: () => string;
  delayMs?: number;
};

type Payload = { type: "event"; payload: { website: string; hostname: string; url: string; language?: string; screen?: string; title?: string; name?: string; data?: PulseProps } };

const KEEP = 100;
const PER_FLUSH = 10;

export function createPulse(opts: PulseOptions) {
  const origin = (opts.origin ?? "https://pulse.shaileshjha.in").replace(/\/$/, "");
  const on = () => Boolean(opts.websiteId) && opts.enabled();
  let queue: Payload[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let sending = false;
  let url = "/";

  function push(p: Omit<Payload["payload"], "website" | "hostname" | "url" | "language" | "screen">) {
    if (!on()) return;
    queue.push({ type: "event", payload: { website: opts.websiteId!, hostname: opts.hostname, url, language: opts.language?.(), screen: opts.screen?.(), ...p } });
    if (queue.length > KEEP) queue = queue.slice(-KEEP);
    if (!timer) timer = setTimeout(() => void flush(), opts.delayMs ?? 3000);
  }

  async function flush() {
    if (timer) clearTimeout(timer);
    timer = null;
    if (sending || !queue.length) return;
    if (!on()) return void (queue = []);
    sending = true;
    const batch = queue.splice(0, PER_FLUSH);
    try {
      // One at a time keeps the order and the radio quiet; a failure drops that event (no retries, no backlog).
      for (const p of batch) await opts.post(`${origin}/api/send`, JSON.stringify(p)).catch(() => undefined);
    } finally {
      sending = false;
    }
    if (queue.length) timer = setTimeout(() => void flush(), 500);
  }

  return {
    /** A screen view. Call on every route change. */
    screen(path: string) {
      url = screenPath(path);
      push({ title: url });
    },
    event(name: PulseEvent, props?: Record<string, unknown>) {
      if (!(PULSE_EVENTS as readonly string[]).includes(name)) return;
      push({ name, data: cleanProps(props) });
    },
    flush,
    /** Drops anything queued (used when the learner turns sharing off). */
    clear: () => void (queue = []),
    pending: () => queue.length,
  };
}
export type Pulse = ReturnType<typeof createPulse>;
