/**
 * Rollout guard: pause an OTA rollout when the newest release's crash-free session rate drops.
 * The decision is a pure function; the Sentry read and the pause call are thin wrappers around fetch.
 */

export type ReleaseHealth = { release: string; sessions: number; crashFreeRate: number | null };
export type GuardPolicy = { minCrashFreeRate: number; minSessions: number };
export const DEFAULT_POLICY: GuardPolicy = { minCrashFreeRate: 0.995, minSessions: 50 };

export function guardDecision(health: ReleaseHealth, policy: GuardPolicy = DEFAULT_POLICY): { pause: boolean; reason: string } {
  const pct = (n: number) => `${(n * 100).toFixed(2)}%`;
  if (health.sessions < policy.minSessions || health.crashFreeRate === null)
    return { pause: false, reason: `${health.release}: ${health.sessions} sessions, fewer than ${policy.minSessions}; not enough to judge` };
  if (health.crashFreeRate < policy.minCrashFreeRate)
    return { pause: true, reason: `${health.release}: crash-free sessions ${pct(health.crashFreeRate)} < ${pct(policy.minCrashFreeRate)} over ${health.sessions} sessions` };
  return { pause: false, reason: `${health.release}: crash-free sessions ${pct(health.crashFreeRate)} over ${health.sessions} sessions` };
}

type Fetch = typeof fetch;

/** Reads the newest release's session health from the Sentry API (needs a token with project:read and org:read). */
export async function sentryReleaseHealth(opts: { token: string; org: string; project: string; period?: string; fetch?: Fetch; base?: string }): Promise<ReleaseHealth | null> {
  const f = opts.fetch ?? fetch;
  const base = (opts.base ?? "https://sentry.io").replace(/\/$/, "");
  const get = async (path: string) => {
    const res = await f(`${base}${path}`, { headers: { authorization: `Bearer ${opts.token}` } });
    if (!res.ok) throw new Error(`Sentry ${path.split("?")[0]} answered ${res.status}`);
    return res.json();
  };
  const project = (await get(`/api/0/projects/${opts.org}/${opts.project}/`)) as { id: string };
  const releases = (await get(`/api/0/organizations/${opts.org}/releases/?project=${project.id}&per_page=1`)) as { version: string }[];
  const release = releases[0]?.version;
  if (!release) return null;
  const query = new URLSearchParams({ project: project.id, statsPeriod: opts.period ?? "7d", interval: "1d", query: `release:"${release}"` });
  query.append("field", "sum(session)");
  query.append("field", "crash_free_rate(session)");
  const stats = (await get(`/api/0/organizations/${opts.org}/sessions/?${query}`)) as { groups: { totals: Record<string, number | null> }[] };
  const totals = stats.groups[0]?.totals ?? {};
  return { release, sessions: Number(totals["sum(session)"] ?? 0), crashFreeRate: totals["crash_free_rate(session)"] ?? null };
}

/** Calls the server's channel pause route. */
export async function pauseRollout(opts: { server: string; channel: string; adminToken: string; fetch?: Fetch }) {
  const f = opts.fetch ?? fetch;
  const res = await f(`${opts.server.replace(/\/$/, "")}/channels/${encodeURIComponent(opts.channel)}/pause`, { method: "POST", headers: { authorization: `Bearer ${opts.adminToken}` } });
  if (!res.ok) throw new Error(`pause answered ${res.status}: ${await res.text()}`);
  return (await res.json()) as { paused: { id: string; platform: string; runtimeVersion: string }[] };
}
