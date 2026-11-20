/**
 * Load test for a LOCAL API: leaderboard, puzzles, and the challenge create / accept / move flow.
 * It refuses any host but localhost, so it can never be pointed at production by mistake.
 *
 *   pnpm --filter chessschool-api run qa:serve            (terminal 1: local API on :8788 with course + puzzles)
 *   pnpm --filter chessschool-api run load-test           (terminal 2)
 *
 * Options (env): LOAD_BASE (default http://127.0.0.1:8788), LOAD_SECONDS per scenario (default 10),
 * LOAD_CONCURRENCY (default 20), LOAD_USERS accounts to create (default 100).
 * Each virtual user sends its own x-forwarded-for, as different phones would; 429s are counted separately.
 */
const base = (process.env.LOAD_BASE ?? "http://127.0.0.1:8788").replace(/\/$/, "");
const host = new URL(base).hostname;
if (!["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)) {
  console.error(`load-test only runs against a local API (got ${host})`);
  process.exit(1);
}
const SECONDS = Number(process.env.LOAD_SECONDS ?? 10);
const CONCURRENCY = Number(process.env.LOAD_CONCURRENCY ?? 20);
const USERS = Number(process.env.LOAD_USERS ?? 100);

type Result = { status: number; ms: number };
const ipFor = (n: number) => `10.${(n >> 16) & 255}.${(n >> 8) & 255}.${n & 255}`;

async function call(
  method: string,
  path: string,
  opts: { token?: string; ip: string; body?: unknown },
): Promise<Result & { json: any }> {
  const t = performance.now();
  try {
    const res = await fetch(base + path, {
      method,
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": opts.ip,
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
      },
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, ms: performance.now() - t, json };
  } catch {
    return { status: 0, ms: performance.now() - t, json: null };
  }
}

const pct = (sorted: number[], p: number) =>
  sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))]!
    : 0;

/** Runs `step` from CONCURRENCY workers for SECONDS and prints throughput and latency. */
async function scenario(
  name: string,
  step: (worker: number, i: number) => Promise<Result[]>,
) {
  const results: Result[] = [];
  const until = performance.now() + SECONDS * 1000;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async (_, w) => {
      for (let i = 0; performance.now() < until; i++)
        results.push(...(await step(w, i)));
    }),
  );
  const ok = results.filter((r) => r.status >= 200 && r.status < 400);
  const limited = results.filter((r) => r.status === 429).length;
  const failed = results.length - ok.length - limited;
  const codes = [...new Set(results.filter((r) => r.status < 200 || (r.status >= 400 && r.status !== 429)).map((r) => r.status))];
  const ms = ok.map((r) => r.ms).sort((a, b) => a - b);
  const row = {
    scenario: name,
    requests: results.length,
    rps: Math.round(results.length / SECONDS),
    p50: Math.round(pct(ms, 50)),
    p95: Math.round(pct(ms, 95)),
    p99: Math.round(pct(ms, 99)),
    max: Math.round(ms.at(-1) ?? 0),
    "429": limited,
    errors: failed,
    ...(codes.length ? { codes: codes.join(",") } : {}),
  };
  console.log(JSON.stringify(row));
  return row;
}

const health = await call("GET", "/v1/health", { ip: ipFor(1) });
if (health.status !== 200) {
  console.error(
    `no API at ${base} (start it with: pnpm --filter chessschool-api run qa:serve)`,
  );
  process.exit(1);
}

// Accounts: each on its own address so the sign-up budget (30 an hour per IP) is not what is measured.
const run = Date.now().toString(36);
const tokens: string[] = [];
for (let i = 0; i < USERS; i++) {
  const r = await call("POST", "/v1/auth/register", {
    ip: ipFor(1000 + i),
    body: {
      name: `Load ${i}`,
      email: `load-${run}-${i}@example.com`,
      password: "pawnpawn",
    },
  });
  if (r.status !== 201)
    throw new Error(`register failed: ${r.status} ${JSON.stringify(r.json)}`);
  tokens.push(r.json.token);
}
const pack = await call("GET", "/v1/puzzles/pack", { ip: ipFor(2) });
const puzzleIds: string[] = (pack.json?.puzzles ?? [])
  .map((p: { id: string }) => p.id)
  .slice(0, 200);

console.log(
  `base ${base}, ${CONCURRENCY} workers x ${SECONDS}s per scenario, ${USERS} accounts, ${puzzleIds.length} puzzles`,
);
const rows = [];
/** A fresh address per request: many phones, so the per-IP budget is not what is measured. */
const phone = (w: number, i: number) => ipFor(100_000 + w * 50_000 + (i % 50_000));
rows.push(
  await scenario("leaderboard global xp", async (w, i) => {
    const n = (w + i * CONCURRENCY) % USERS;
    return [
      await call("GET", "/v1/leaderboard?scope=global&metric=xp", {
        token: tokens[n],
        ip: ipFor(1000 + n),
      }),
    ];
  }),
);
rows.push(
  await scenario("puzzle pack", async (w, i) => [
    await call("GET", "/v1/puzzles/pack", { ip: phone(w, i) }),
  ]),
);
if (puzzleIds.length)
  rows.push(
    await scenario("puzzle by id", async (w, i) => [
      await call("GET", `/v1/puzzles/${puzzleIds[(w * 31 + i) % puzzleIds.length]}`, {
        ip: phone(w, i),
      }),
    ]),
  );

// A short opening, played to the end each time: create, accept, then alternating moves.
const LINE = [
  ["e2", "e4"],
  ["e7", "e5"],
  ["g1", "f3"],
  ["b8", "c6"],
  ["f1", "c4"],
  ["g8", "f6"],
] as const;
rows.push(
  await scenario("challenge create+accept+6 moves", async (w, i) => {
    // Rotate creators: each account may open 20 challenges a day (CHALLENGES_PER_DAY).
    const n = (w + i * CONCURRENCY) % USERS;
    const creator = tokens[n]!;
    const ip = ipFor(1000 + n);
    const out: Result[] = [];
    const made = await call("POST", "/v1/challenges", {
      token: creator,
      ip,
      body: { kind: "game", tc: "none" },
    });
    out.push(made);
    const code = made.json?.challenge?.code;
    if (!code) return out;
    const friendIp = ipFor(5000 + w * 100 + (i % 100));
    const accepted = await call("POST", `/v1/challenges/${code}/accept`, {
      ip: friendIp,
      body: {},
    });
    out.push(accepted);
    const seat = accepted.json?.seat;
    if (!seat) return out;
    for (let m = 0; m < LINE.length; m++) {
      const [from, to] = LINE[m]!;
      const r =
        m % 2 === 0
          ? await call("POST", `/v1/challenges/${code}/moves`, {
              token: creator,
              ip,
              body: { from, to },
            })
          : await call("POST", `/v1/challenges/${code}/moves`, {
              ip: friendIp,
              body: { from, to, seat },
            });
      out.push(r);
      if (r.status !== 200) break;
    }
    return out;
  }),
);
// One address hammering a public route: the general budget (600 a minute) should answer 429 with Retry-After.
rows.push(
  await scenario("one IP flooding (expect 429)", async () => [
    await call("GET", "/v1/puzzles/pack", { ip: "10.250.250.250" }),
  ]),
);
console.table(rows);
