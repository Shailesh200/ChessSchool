import { sharedDailyPuzzle } from "@chessschool/chess";
import { sanitizeGameRecord } from "@chessschool/design";
import { and, count, desc, eq, lt } from "drizzle-orm";
import type { Context, Hono } from "hono";
import type { Db } from "./db";
import { loadPuzzlePack } from "./puzzles";
import { children, dailySolves, savedGames, users } from "./schema";

type UserRow = typeof users.$inferSelect;
type Guard = (c: Context<{ Variables: { user: UserRow } }>, next: () => Promise<void>) => Promise<unknown>;
export type PlayDeps = { db: Db; now: () => Date; requireUser: Guard; userFromRequest: (c: Context) => Promise<UserRow | null>; limiter: (key: string) => boolean };

/** Games kept per learner on the server (the oldest go first); the list returns the newest GAMES_PAGE. */
export const GAMES_KEPT = 500;
export const GAMES_PAGE = 100;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const GUEST = /^[A-Za-z0-9-]{8,64}$/;

/**
 * A local day the server accepts for the daily puzzle: within a day of the server's UTC date either way,
 * so every time zone's "today" works and nobody can count tomorrow's puzzle early.
 */
export function dailyDayOk(day: string, nowMs: number): boolean {
  if (!DAY.test(day)) return false;
  const t = Date.parse(`${day}T00:00:00Z`);
  if (!Number.isFinite(t)) return false;
  const today = Date.parse(`${new Date(nowMs).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.abs(t - today) <= 86_400_000;
}

const ip = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";

/** Rows to delete with an account (its and its children's games, and its daily-puzzle solves). */
export const playDeletes = (db: Db, userId: string) => [db.delete(savedGames).where(eq(savedGames.userId, userId)), db.delete(dailySolves).where(eq(dailySolves.solver, `u:${userId}`))];
/** Rows to delete with one child profile. */
export const childPlayDeletes = (db: Db, childId: string) => [db.delete(savedGames).where(eq(savedGames.learnerId, childId))];

export function mountPlay(app: Hono<{ Variables: { user: UserRow } }>, { db, now, requireUser, userFromRequest, limiter }: PlayDeps) {
  /** The learner a request is about: the account, or one of its children. Null when the child is not theirs. */
  const learnerOf = async (userId: string, child: unknown) => {
    if (child === undefined || child === null || child === "") return userId;
    if (typeof child !== "string") return null;
    return (await db.query.children.findFirst({ where: and(eq(children.id, child), eq(children.userId, userId)) })) ? child : null;
  };

  /* ---------- my games ---------- */

  app.get("/v1/games", requireUser, async (c) => {
    const learner = await learnerOf(c.get("user").id, c.req.query("child"));
    if (!learner) return fail(c, "not_found");
    const rows = await db.select({ data: savedGames.data }).from(savedGames).where(eq(savedGames.learnerId, learner)).orderBy(desc(savedGames.endedAt)).limit(GAMES_PAGE);
    const games = rows.flatMap((r) => {
      try {
        const g = sanitizeGameRecord(JSON.parse(r.data));
        return g ? [g] : [];
      } catch {
        return [];
      }
    });
    return c.json({ games });
  });

  /** Saves one finished game. The same id again replaces it, so a retried save is harmless. */
  app.put("/v1/games/:id", requireUser, async (c) => {
    const user = c.get("user");
    if (!limiter(`games:${user.id}`)) return fail(c, "rate_limited");
    const b = (await c.req.json().catch(() => null)) as { game?: unknown; child?: unknown } | null;
    const game = sanitizeGameRecord(b?.game);
    if (!game || game.id !== c.req.param("id")) return fail(c, "invalid_input");
    const learner = await learnerOf(user.id, b?.child);
    if (!learner) return fail(c, "not_found");
    const at = now().getTime();
    // A device clock far in the future must not pin a game to the top for ever.
    const endedAt = Math.min(game.endedAt, at + 86_400_000);
    const data = JSON.stringify({ ...game, endedAt, reviewed: undefined });
    await db
      .insert(savedGames)
      .values({ learnerId: learner, id: game.id, userId: user.id, endedAt, data, updatedAt: at })
      .onConflictDoUpdate({ target: [savedGames.learnerId, savedGames.id], set: { endedAt, data, updatedAt: at } });
    const [{ n }] = await db.select({ n: count() }).from(savedGames).where(eq(savedGames.learnerId, learner));
    if (n > GAMES_KEPT) {
      const cut = await db.select({ endedAt: savedGames.endedAt }).from(savedGames).where(eq(savedGames.learnerId, learner)).orderBy(desc(savedGames.endedAt)).limit(1).offset(GAMES_KEPT - 1);
      if (cut[0]) await db.delete(savedGames).where(and(eq(savedGames.learnerId, learner), lt(savedGames.endedAt, cut[0].endedAt)));
    }
    return c.json({ ok: true });
  });

  app.delete("/v1/games/:id", requireUser, async (c) => {
    const learner = await learnerOf(c.get("user").id, c.req.query("child"));
    if (!learner) return fail(c, "not_found");
    await db.delete(savedGames).where(and(eq(savedGames.learnerId, learner), eq(savedGames.id, c.req.param("id") ?? "")));
    return c.json({ ok: true });
  });

  /* ---------- the daily puzzle ---------- */

  const solvedCount = async (day: string) => (await db.select({ n: count() }).from(dailySolves).where(eq(dailySolves.day, day)))[0]?.n ?? 0;

  /** The shared daily puzzle for a local day, and how many learners solved it. */
  app.get("/v1/daily/:day", async (c) => {
    const day = c.req.param("day") ?? "";
    if (!dailyDayOk(day, now().getTime())) return fail(c, "not_found");
    const pack = await loadPuzzlePack(db);
    const puzzle = pack ? sharedDailyPuzzle(day, pack.puzzles) : null;
    if (!puzzle) return fail(c, "not_found");
    return c.json({ day, puzzle, solved: await solvedCount(day) });
  });

  /**
   * One solve of the day's puzzle: { puzzle, solver? }. Signed in, the account counts once; a guest sends the
   * device's random guest id instead. Repeats change nothing, so a queued solve can be sent again safely.
   */
  app.post("/v1/daily/:day", async (c) => {
    const day = c.req.param("day") ?? "";
    if (!dailyDayOk(day, now().getTime())) return fail(c, "not_found");
    if (!limiter(`daily:${ip(c)}`)) return fail(c, "rate_limited");
    const b = (await c.req.json().catch(() => null)) as { puzzle?: unknown; solver?: unknown } | null;
    const puzzle = typeof b?.puzzle === "string" && /^[A-Za-z0-9-]{1,40}$/.test(b.puzzle) ? b.puzzle : null;
    if (!puzzle) return fail(c, "invalid_input");
    const user = await userFromRequest(c);
    const solver = user ? `u:${user.id}` : typeof b?.solver === "string" && GUEST.test(b.solver) ? `g:${b.solver}` : null;
    if (!solver) return fail(c, "invalid_input");
    await db.insert(dailySolves).values({ day, solver, puzzleId: puzzle, createdAt: now().getTime() }).onConflictDoNothing();
    return c.json({ solved: await solvedCount(day) });
  });
}

const STATUS = { invalid_input: 400, not_found: 404, rate_limited: 429 } as const;
const fail = (c: Context, code: keyof typeof STATUS) => c.json({ error: code }, STATUS[code]);
