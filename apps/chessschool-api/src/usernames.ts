import { normalizeUsername, suggestUsername, usernameProblem, type UsernameProblem } from "@chessschool/design";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import type { Context, Hono } from "hono";
import type { Db } from "./db";
import { users } from "./schema";
import { createRateLimiter } from "./security";

/**
 * Phase 5 usernames: unique ignoring case (index cs_users_username), stored lower case.
 * Accounts made before them get one the first time the API sees them (sign-in, /v1/me) and in a boot backfill.
 */

type UserRow = typeof users.$inferSelect;
type Vars = { Variables: { user: UserRow } };
type Guard = (c: Context<Vars>, next: () => Promise<void>) => Promise<unknown>;

const isUniqueClash = (err: unknown) => /UNIQUE constraint failed|SQLITE_CONSTRAINT/i.test(String(err) + String((err as { cause?: unknown })?.cause ?? ""));

const random = () => {
  const b = new Uint32Array(1);
  crypto.getRandomValues(b);
  return b[0]! / 2 ** 32;
};

/** The account whose username is `raw` (any case), or null. */
export async function userByUsername(db: Db, raw: string): Promise<UserRow | null> {
  const u = normalizeUsername(raw);
  if (!u) return null;
  return (await db.query.users.findFirst({ where: sql`${users.username} = ${u} COLLATE NOCASE` })) ?? null;
}

/** Gives the account a username if it has none (first name + 4 digits, retried on a clash) and returns it. */
export async function ensureUsername(db: Db, user: Pick<UserRow, "id" | "name" | "username">, rand: () => number = random): Promise<string> {
  if (user.username) return user.username;
  for (let i = 0; i < 12; i++) {
    // After a few clashes on a busy name, six digits.
    const candidate = suggestUsername(user.name, rand, i < 8 ? 4 : 6);
    try {
      const done = await db.update(users).set({ username: candidate }).where(and(eq(users.id, user.id), isNull(users.username))).returning({ username: users.username });
      if (done.length) {
        user.username = candidate;
        return candidate;
      }
      // Set meanwhile by another request: use that one.
      const row = await db.query.users.findFirst({ where: eq(users.id, user.id) });
      if (row?.username) return (user.username = row.username);
      throw new Error("account not found");
    } catch (err) {
      if (!isUniqueClash(err)) throw err;
    }
  }
  throw new Error("no free username");
}

/** Gives every account still without a username one; returns how many were filled. Cheap when none are left. */
export async function backfillUsernames(db: Db, limit = 1000): Promise<number> {
  const rows = await db.select({ id: users.id, name: users.name, username: users.username }).from(users).where(isNull(users.username)).limit(limit);
  for (const row of rows) await ensureUsername(db, row);
  return rows.length;
}

/** Why `raw` can't be this account's new username (taken counts), or null. */
export async function usernameIssue(db: Db, userId: string, raw: string): Promise<UsernameProblem | null> {
  const problem = usernameProblem(raw);
  if (problem) return problem;
  const other = await db.query.users.findFirst({ where: and(sql`${users.username} = ${normalizeUsername(raw)} COLLATE NOCASE`, ne(users.id, userId)) });
  return other ? "taken" : null;
}

export function mountUsernames(app: Hono<Vars>, { db, now, requireUser }: { db: Db; now: () => Date; requireUser: Guard }) {
  const clock = () => now().getTime();
  // Typing checks availability after a pause, so a generous budget; changes are rarer.
  const checkLimiter = createRateLimiter(120, 10 * 60_000, clock);
  const setLimiter = createRateLimiter(20, 60 * 60_000, clock);
  const fail = (c: Context, status: number, error: string, message?: string) => c.json({ error, message }, status as 400);

  /** Live availability while the learner types: `problem` is null when the name is free (or already theirs). */
  app.get("/v1/usernames/check", requireUser, async (c) => {
    const me = c.get("user");
    if (!checkLimiter(me.id)) return fail(c, 429, "rate_limited");
    const raw = c.req.query("u") ?? "";
    const problem = await usernameIssue(db, me.id, raw);
    return c.json({ username: normalizeUsername(raw), available: !problem, problem });
  });

  app.put("/v1/me/username", requireUser, async (c) => {
    const me = c.get("user");
    if (!setLimiter(me.id)) return fail(c, 429, "rate_limited");
    let raw = "";
    try {
      raw = String(((await c.req.json()) as { username?: unknown })?.username ?? "");
    } catch {}
    const problem = await usernameIssue(db, me.id, raw);
    if (problem) return fail(c, problem === "taken" ? 409 : 400, problem === "taken" ? "conflict" : "invalid_input", problem);
    const username = normalizeUsername(raw);
    try {
      await db.update(users).set({ username }).where(eq(users.id, me.id));
    } catch (err) {
      if (isUniqueClash(err)) return fail(c, 409, "conflict", "taken");
      throw err;
    }
    return c.json({ username });
  });
}
