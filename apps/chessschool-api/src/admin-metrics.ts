import { sql } from "drizzle-orm";
import type { AdminMetrics, GameRecord } from "@chessschool/design";
import type { Db } from "./db";
import { isQaEmail } from "./qa-accounts";

const DAY = 86_400_000;
const dayOf = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const parse = (s: string): GameRecord | null => {
  try {
    return JSON.parse(s) as GameRecord;
  } catch {
    return null;
  }
};

/** Product numbers for the admin dashboard, from the tables the app already writes. QA test accounts are left out. */
export async function adminMetrics(
  db: Db,
  nowMs: number,
  days: number,
): Promise<AdminMetrics> {
  const since = nowMs - days * DAY;
  const sinceDay = dayOf(since);
  // shortcut: accounts are read whole and filtered here; move the QA filter into SQL past ~50k accounts.
  const people = (
    await db.all<{
      id: string;
      email: string;
      kind: string;
      pw: number;
      google: number;
      apple: number;
      created: number;
    }>(
      sql`SELECT id, email, kind, password_hash IS NOT NULL AS pw, google_sub IS NOT NULL AS google, apple_sub IS NOT NULL AS apple, created_at AS created FROM cs_users`,
    )
  ).filter((u) => !isQaEmail(u.email));
  const real = new Set(people.map((u) => u.id));
  const members = people.filter((u) => u.kind === "member");
  const fresh = members.filter((u) => u.created >= since);
  const newDaily = new Map<string, number>();
  for (const u of fresh)
    newDaily.set(dayOf(u.created), (newDaily.get(dayOf(u.created)) ?? 0) + 1);

  const active = await db.all<{ id: string }>(
    sql`SELECT user_id AS id FROM cs_progress WHERE updated_at >= ${since}`,
  );

  const games = { total: 0, bot: 0, friend: 0, other: 0, won: 0, lost: 0, drawn: 0 };
  const bots = new Map<string, { played: number; won: number }>();
  for (const r of await db.all<{ data: string }>(
    sql`SELECT data FROM cs_saved_games WHERE ended_at >= ${since}`,
  )) {
    const g = parse(r.data);
    if (!g?.setup?.opponent) continue;
    games.total++;
    const kind = g.setup.opponent.kind;
    if (kind === "bot") games.bot++;
    else if (kind === "friend" || kind === "online") games.friend++;
    else games.other++;
    const won = g.winner !== null && g.winner === g.setup.you;
    if (g.winner === null) games.drawn++;
    else if (won) games.won++;
    else games.lost++;
    if (g.setup.opponent.kind === "bot") {
      const b = bots.get(g.setup.opponent.bot) ?? { played: 0, won: 0 };
      b.played++;
      if (won) b.won++;
      bots.set(g.setup.opponent.bot, b);
    }
  }

  const challengeRows = await db.all<{
    tc: string | null;
    status: string;
    joined: number;
    n: number;
  }>(
    sql`SELECT tc, status, black_seat IS NOT NULL AS joined, count(*) AS n FROM cs_challenges WHERE created_at >= ${since} AND kind = 'game' GROUP BY 1, 2, 3`,
  );
  const challenges = {
    created: 0,
    joined: 0,
    finished: 0,
    byClock: {} as Record<string, number>,
  };
  for (const r of challengeRows) {
    challenges.created += r.n;
    if (r.joined) challenges.joined += r.n;
    if (r.status === "over") challenges.finished += r.n;
    const tc = r.tc ?? "none";
    challenges.byClock[tc] = (challenges.byClock[tc] ?? 0) + r.n;
  }

  const daily = await db.all<{ day: string; n: number }>(
    sql`SELECT day, count(*) AS n FROM cs_daily_solves WHERE day >= ${sinceDay} GROUP BY day ORDER BY day`,
  );
  const ai = await db.all<{ day: string; n: number; users: number }>(
    sql`SELECT day, sum(count) AS n, count(DISTINCT user_id) AS users FROM cs_coach_usage WHERE day >= ${sinceDay} GROUP BY day ORDER BY day`,
  );
  const countries = (
    await db.all<{ id: string; country: string }>(
      sql`SELECT user_id AS id, country FROM cs_profiles WHERE country IS NOT NULL`,
    )
  ).filter((r) => real.has(r.id));
  const byCountry = new Map<string, number>();
  for (const r of countries)
    byCountry.set(r.country, (byCountry.get(r.country) ?? 0) + 1);
  const [support] = await db.all<{ n: number }>(
    sql`SELECT count(*) AS n FROM cs_support WHERE created_at >= ${since}`,
  );
  const [reports] = await db.all<{ n: number }>(
    sql`SELECT count(*) AS n FROM cs_reports WHERE created_at >= ${since}`,
  );

  return {
    days,
    accounts: {
      total: members.length,
      new: fresh.length,
      daily: [...newDaily]
        .map(([day, n]) => ({ day, n }))
        .sort((a, b) => a.day.localeCompare(b.day)),
      methods: {
        password: members.filter((u) => u.pw).length,
        google: members.filter((u) => u.google).length,
        apple: members.filter((u) => u.apple).length,
      },
      activeLearners: active.filter((r) => real.has(r.id)).length,
    },
    games: {
      ...games,
      bots: [...bots]
        .map(([bot, b]) => ({ bot, ...b }))
        .sort((a, b) => b.played - a.played),
    },
    challenges,
    dailyPuzzle: {
      solves: daily.reduce((n, d) => n + d.n, 0),
      daily: daily.map((d) => ({ day: d.day, n: d.n })),
    },
    ai: {
      requests: ai.reduce((n, d) => n + d.n, 0),
      users: Math.max(0, ...ai.map((d) => d.users)),
      daily: ai.map((d) => ({ day: d.day, n: d.n })),
    },
    countries: [...byCountry]
      .map(([country, n]) => ({ country, n }))
      .sort((a, b) => b.n - a.n)
      .slice(0, 8),
    support: support?.n ?? 0,
    reports: reports?.n ?? 0,
  };
}
