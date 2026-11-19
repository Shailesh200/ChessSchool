import { baseMs, clockAfterMove, clockAt, isAvatarId, isLang, isTimeControl, FREEZE_MAX, JOIN_MS, type AvatarId, type ClockData, type Progress, type TimeControl } from "@chessschool/design";
import { and, eq, gte, sql } from "drizzle-orm";
import type { Context, Hono } from "hono";
import { randomBytes } from "node:crypto";
import { playMove, splitMoves } from "./class-play";
import type { Db } from "./db";
import { FEATURES } from "./features";
import { loadPuzzle } from "./puzzles";
import { challenges, children, freezeBank, inviteAccepts, invites, profiles, shares, users } from "./schema";
import { hashToken, newToken } from "./security";
import { cardData, cardId, CARD_VERSION, isCardKind, renderCard, SHARE_ORIGIN, type Card, type CardStore } from "./share-card";

/**
 * Sharing and growth (Phase 3 track D): share cards, challenge-a-friend links and invite rewards.
 * No chat anywhere, and a child profile never shows a name: only its avatar.
 */
export const CHALLENGE_DAYS = 7;
export const CHALLENGES_PER_DAY = 20;
export const INVITE_LESSONS = 3;
export const INVITE_FREEZES = 2;
export const INVITE_MONTHLY_CAP = 10;
const DAY = 86_400_000;

/** Short link codes: no look-alike letters (0/O, 1/l/I). */
const ALPHABET = "23456789abcdefghjkmnpqrstuvwxyz";
export const newCode = (n = 8) => Array.from(randomBytes(n), (b) => ALPHABET[b % ALPHABET.length]).join("");
const CODE = /^[2-9a-z]{6,12}$/;
const firstName = (name: string) => name.trim().split(/\s+/)[0]?.slice(0, 20) || null;

type UserRow = typeof users.$inferSelect;
type ChallengeRow = typeof challenges.$inferSelect;
type Guard = (c: Context<{ Variables: { user: UserRow } }>, next: () => Promise<void>) => Promise<unknown>;
export type GrowthDeps = {
  db: Db;
  now: () => Date;
  requireUser: Guard;
  userFromRequest: (c: Context) => Promise<UserRow | null | undefined>;
  /** True while the caller (by key) is under the write limit. */
  limiter: (key: string) => boolean;
  /** Rendered card cache (R2 in production). Without one, cards are rendered on each request. */
  cardStore?: CardStore | null;
};

const fail = (c: Context, status: number, error: string) => c.json({ error }, status as 400);
const json = async (c: Context): Promise<Record<string, unknown>> => {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
};
const ipOf = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || "local";

/** Lessons the learner did themselves: not the tour, not ones skipped by placement. */
export function lessonsDone(p: Progress): number {
  const placed = new Set(p.placed);
  return Object.keys(p.completed).filter((id) => id !== "meet" && !placed.has(id)).length;
}

const addToBank = (db: Db, userId: string, n: number) =>
  db.insert(freezeBank).values({ userId, banked: n }).onConflictDoUpdate({ target: freezeBank.userId, set: { banked: sql`${freezeBank.banked} + ${n}` } });

/**
 * Called when an account's progress is saved. Once an invited friend has finished INVITE_LESSONS
 * lessons, both sides get INVITE_FREEZES streak freezes in their bank, once. An inviter who already
 * earned INVITE_MONTHLY_CAP rewards in the last 30 days gets none for this one; the friend still does.
 */
export async function payInvite(db: Db, invitedId: string, p: Progress, nowMs: number): Promise<boolean> {
  if (!FEATURES.invites || lessonsDone(p) < INVITE_LESSONS) return false;
  const row = await db.query.inviteAccepts.findFirst({ where: eq(inviteAccepts.invitedId, invitedId) });
  if (!row || row.rewardedAt) return false;
  const [paid] = await db
    .select({ n: sql<number>`count(*)` })
    .from(inviteAccepts)
    .where(and(eq(inviteAccepts.inviterId, row.inviterId), eq(inviteAccepts.inviterRewarded, true), gte(inviteAccepts.rewardedAt, nowMs - 30 * DAY)));
  const inviterPaid = Number(paid?.n ?? 0) < INVITE_MONTHLY_CAP;
  // Only the request that flips rewarded_at pays, so two saves at once cannot pay twice.
  const claimed = await db.update(inviteAccepts).set({ rewardedAt: nowMs, inviterRewarded: inviterPaid }).where(and(eq(inviteAccepts.invitedId, invitedId), sql`${inviteAccepts.rewardedAt} is null`));
  if (!claimed.rowsAffected) return false;
  await addToBank(db, invitedId, INVITE_FREEZES);
  if (inviterPaid) await addToBank(db, row.inviterId, INVITE_FREEZES);
  return true;
}

/** Rows to delete with an account (used by account-delete.ts). */
export const growthDeletes = (db: Db, userId: string) => [
  db.delete(shares).where(eq(shares.userId, userId)),
  db.delete(challenges).where(eq(challenges.creatorId, userId)),
  db.delete(invites).where(eq(invites.userId, userId)),
  db.delete(inviteAccepts).where(sql`${inviteAccepts.invitedId} = ${userId} or ${inviteAccepts.inviterId} = ${userId}`),
  db.delete(freezeBank).where(eq(freezeBank.userId, userId)),
];

export function mountGrowth(app: Hono<{ Variables: { user: UserRow } }>, { db, now, requireUser, userFromRequest, limiter, cardStore = null }: GrowthDeps) {
  const on = (flag: keyof typeof FEATURES) => async (c: Context, next: () => Promise<void>) => (FEATURES[flag] ? next() : fail(c, 404, "not_found"));


  /** Who a card or challenge shows: the account's avatar and (if asked) first name, or a child's avatar and no name. */
  async function face(user: UserRow | null | undefined, child: unknown, showName: boolean, avatar: unknown): Promise<{ avatar: AvatarId; name: string | null } | null> {
    if (!user) return { avatar: isAvatarId(avatar) ? avatar : "cody", name: null };
    if (typeof child === "string" && child) {
      const kid = await db.query.children.findFirst({ where: and(eq(children.id, child), eq(children.userId, user.id)) });
      return kid ? { avatar: isAvatarId(kid.avatar) ? kid.avatar : "cody", name: null } : null;
    }
    const profile = await db.query.profiles.findFirst({ where: eq(profiles.userId, user.id) });
    return { avatar: isAvatarId(profile?.avatar) ? profile.avatar : "cody", name: showName ? firstName(user.name) : null };
  }

  /* ---------- share cards ---------- */

  /** Saves what a card shows and returns its link. The same content always gets the same id. */
  app.post("/v1/shares", on("shareCards"), async (c) => {
    const user = await userFromRequest(c);
    if (!limiter(`share:${user?.id ?? ipOf(c)}`)) return fail(c, 429, "rate_limited");
    const b = await json(c);
    if (!isCardKind(b.kind)) return fail(c, 400, "invalid_input");
    const data = cardData(b.kind, b.data);
    const who = await face(user, b.child, b.showName === true, b.avatar);
    if (!data || !who) return fail(c, 400, "invalid_input");
    const card: Card = { kind: b.kind, lang: isLang(b.lang) ? b.lang : "en", data, ...who };
    const id = cardId(card);
    await db.insert(shares).values({ id, kind: card.kind, lang: card.lang, data: JSON.stringify(data), avatar: card.avatar, name: card.name, userId: user?.id ?? null, createdAt: now().getTime() }).onConflictDoNothing();
    return c.json({ id, url: `${SHARE_ORIGIN}/s/${id}`, image: `/v1/share/card/${card.kind}?id=${id}` }, 201);
  });

  const loadCard = async (id: string): Promise<Card | null> => {
    const row = /^[\w-]{8,20}$/.test(id) ? await db.query.shares.findFirst({ where: eq(shares.id, id) }) : null;
    if (!row || !isCardKind(row.kind)) return null;
    return { kind: row.kind, lang: isLang(row.lang) ? row.lang : "en", data: JSON.parse(row.data), avatar: isAvatarId(row.avatar) ? row.avatar : "cody", name: row.name };
  };

  /** What the /s/<id> page needs. */
  app.get("/v1/shares/:id", on("shareCards"), async (c) => {
    const id = c.req.param("id") ?? "";
    const card = await loadCard(id);
    return card ? c.json({ id, kind: card.kind, lang: card.lang, image: `/v1/share/card/${card.kind}?id=${id}` }) : fail(c, 404, "not_found");
  });

  /** The 1080x1920 PNG. Rendered once, then served from the cache. */
  app.get("/v1/share/card/:kind", on("shareCards"), async (c) => {
    const id = c.req.query("id") ?? "";
    const card = await loadCard(id);
    if (!card || card.kind !== c.req.param("kind")) return fail(c, 404, "not_found");
    const key = `cards/v${CARD_VERSION}/${id}.png`;
    let png = cardStore ? await cardStore.get(key).catch(() => null) : null;
    if (!png) {
      png = await renderCard(card, id);
      if (cardStore) await cardStore.put(key, png).catch(() => {});
    }
    return new Response(png as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=31536000, immutable" } });
  });

  /* ---------- challenge a friend ---------- */

  const findChallenge = async (code: string) => (CODE.test(code) ? ((await db.query.challenges.findFirst({ where: eq(challenges.code, code) })) ?? null) : null);

  const clockData = (row: ChallengeRow): ClockData | null =>
    row.turnStartedAt === null ? null : { tc: row.tc as TimeControl, whiteMs: row.whiteMs, blackMs: row.blackMs, turnStartedAt: row.turnStartedAt, plies: splitMoves(row.moves).length };

  /** Ends a running game that ran out of time or was called off, and saves that (any read or move settles it first). */
  async function settle(row: ChallengeRow): Promise<ChallengeRow> {
    const data = row.kind === "game" && row.status === "active" ? clockData(row) : null;
    if (!data) return row;
    const v = clockAt(data, now().getTime());
    if (!v.flagged && !v.aborted) return row;
    const next = { status: "over", result: v.flagged ? (v.flagged === "w" ? "0-1" : "1-0") : null, endReason: v.flagged ? "time" : "aborted", drawOffer: null };
    await db.update(challenges).set(next).where(and(eq(challenges.code, row.code), eq(challenges.moves, row.moves), eq(challenges.status, "active")));
    return { ...row, ...next };
  }

  async function view(row: ChallengeRow, you: "w" | "b" | null) {
    const at = now().getTime();
    const expired = row.expiresAt <= at || (row.status === "waiting" && row.joinBy !== null && row.joinBy <= at);
    const moves = splitMoves(row.moves);
    const data = row.status === "active" ? clockData(row) : null;
    const puzzle = row.kind === "puzzle" && row.puzzleId ? await loadPuzzle(db, row.puzzleId) : null;
    return {
      code: row.code,
      kind: row.kind,
      url: `${SHARE_ORIGIN}/c/${row.code}`,
      creator: { name: row.name, avatar: row.avatar },
      expired,
      expiresAt: row.expiresAt,
      status: row.status,
      you,
      yourTurn: row.kind === "game" && row.status === "active" && !expired && you === (moves.length % 2 ? "b" : "w"),
      moves,
      result: row.result,
      creatorResult: row.creatorResult,
      friendResult: row.friendResult,
      puzzle: puzzle ? { id: puzzle.id, fen: puzzle.fen, moves: puzzle.moves, rating: puzzle.rating, themes: puzzle.themes } : null,
      tc: row.tc as TimeControl,
      joinBy: row.joinBy,
      drawOffer: row.drawOffer as "w" | "b" | null,
      endReason: row.endReason,
      // `at` is the server's clock, so the app can count down from it without trusting the phone's time.
      clock: data ? { ...clockAt(data, at), at } : null,
    };
  }

  /** The creator is known by their session (white); the friend by the seat token they got on accepting (black). */
  async function seatOf(c: Context, row: ChallengeRow, seat: unknown): Promise<"w" | "b" | null> {
    if (typeof seat === "string" && seat && row.blackSeat === hashToken(seat)) return "b";
    const user = await userFromRequest(c);
    return user?.id === row.creatorId ? "w" : null;
  }

  app.post("/v1/challenges", on("challenges"), requireUser, async (c) => {
    const user = c.get("user");
    const b = await json(c);
    const at = now().getTime();
    const kind = b.kind === "game" ? "game" : b.kind === "puzzle" ? "puzzle" : null;
    const puzzle = kind === "puzzle" && typeof b.puzzleId === "string" ? await loadPuzzle(db, b.puzzleId) : null;
    const who = await face(user, b.child, true, null);
    if (!kind || !who || (kind === "puzzle" && !puzzle)) return fail(c, 400, "invalid_input");
    const [made] = await db.select({ n: sql<number>`count(*)` }).from(challenges).where(and(eq(challenges.creatorId, user.id), gte(challenges.createdAt, at - DAY)));
    if (Number(made?.n ?? 0) >= CHALLENGES_PER_DAY) return fail(c, 429, "rate_limited");
    const row: ChallengeRow = {
      code: newCode(),
      creatorId: user.id,
      kind,
      puzzleId: puzzle?.id ?? null,
      name: who.name,
      avatar: who.avatar,
      creatorResult: kind === "puzzle" && typeof b.solved === "boolean" ? (b.solved ? "solved" : "missed") : null,
      friendResult: null,
      blackSeat: null,
      moves: "",
      status: kind === "game" ? "waiting" : "open",
      result: null,
      createdAt: at,
      expiresAt: at + CHALLENGE_DAYS * DAY,
      tc: kind === "game" && isTimeControl(b.tc) ? b.tc : "none",
      whiteMs: null,
      blackMs: null,
      turnStartedAt: null,
      joinBy: kind === "game" ? at + JOIN_MS : null,
      drawOffer: null,
      endReason: null,
    };
    await db.insert(challenges).values(row);
    return c.json({ challenge: await view(row, "w") }, 201);
  });

  app.get("/v1/challenges/:code", on("challenges"), async (c) => {
    const row = await findChallenge(c.req.param("code") ?? "");
    if (!row) return fail(c, 404, "not_found");
    return c.json({ challenge: await view(await settle(row), await seatOf(c, row, c.req.query("seat"))) });
  });

  /** A friend takes the black seat of a game. No account needed; the seat token is their key. */
  app.post("/v1/challenges/:code/accept", on("challenges"), async (c) => {
    if (!limiter(`accept:${ipOf(c)}`)) return fail(c, 429, "rate_limited");
    const row = await findChallenge(c.req.param("code") ?? "");
    if (!row || row.kind !== "game") return fail(c, 404, "not_found");
    const at = now().getTime();
    if (row.expiresAt <= at || (row.joinBy !== null && row.joinBy <= at)) return fail(c, 410, "expired");
    if ((await userFromRequest(c))?.id === row.creatorId) return fail(c, 409, "conflict");
    const seat = newToken();
    const base = baseMs(row.tc as TimeControl);
    // The clocks start when the friend sits down; a game may then run for weeks on the day clock.
    const started = { blackSeat: hashToken(seat), status: "active", turnStartedAt: at, whiteMs: base, blackMs: base, expiresAt: at + 90 * DAY };
    const taken = await db.update(challenges).set(started).where(and(eq(challenges.code, row.code), sql`${challenges.blackSeat} is null`));
    if (!taken.rowsAffected) return fail(c, 409, "conflict");
    return c.json({ seat, challenge: await view({ ...row, ...started }, "b") });
  });

  app.post("/v1/challenges/:code/moves", on("challenges"), async (c) => {
    const found = await findChallenge(c.req.param("code") ?? "");
    if (!found || found.kind !== "game") return fail(c, 404, "not_found");
    const row = await settle(found);
    const b = await json(c);
    const you = await seatOf(c, row, b.seat);
    if (!you) return fail(c, 403, "forbidden");
    if (!limiter(`move:${row.code}:${you}`)) return fail(c, 429, "rate_limited");
    if (row.expiresAt <= now().getTime()) return fail(c, 410, "expired");
    if (row.status !== "active" || you !== (splitMoves(row.moves).length % 2 ? "b" : "w")) return fail(c, 409, "conflict");
    const played = playMove(row.moves, String(b.from ?? ""), String(b.to ?? ""), typeof b.promotion === "string" ? b.promotion : undefined);
    if (!played) return fail(c, 400, "invalid_input");
    const data = clockData(row);
    const clock = data ? clockAfterMove(data, now().getTime()) : null;
    const next = { moves: played.moves, status: played.over ? "over" : "active", result: played.over?.result ?? null, whiteMs: clock?.whiteMs ?? row.whiteMs, blackMs: clock?.blackMs ?? row.blackMs, turnStartedAt: clock?.turnStartedAt ?? row.turnStartedAt, drawOffer: null };
    // Only lands on the position we checked (same guard as class games).
    const res = await db.update(challenges).set(next).where(and(eq(challenges.code, row.code), eq(challenges.moves, row.moves), eq(challenges.status, "active")));
    if (!res.rowsAffected) return fail(c, 409, "conflict");
    return c.json({ challenge: await view({ ...row, ...next }, you) });
  });

  /** Resign (either player) or offer a draw; offering when the other side already offered agrees to it. */
  app.post("/v1/challenges/:code/:action{resign|draw}", on("challenges"), async (c) => {
    const found = await findChallenge(c.req.param("code") ?? "");
    if (!found || found.kind !== "game") return fail(c, 404, "not_found");
    const row = await settle(found);
    const b = await json(c);
    const you = await seatOf(c, row, b.seat);
    if (!you) return fail(c, 403, "forbidden");
    if (!limiter(`end:${row.code}:${you}`)) return fail(c, 429, "rate_limited");
    if (row.status !== "active") return fail(c, 409, "conflict");
    const other = you === "w" ? "b" : "w";
    const next =
      c.req.param("action") === "resign"
        ? { status: "over", result: you === "w" ? "0-1" : "1-0", endReason: "resign", drawOffer: null }
        : row.drawOffer === other
          ? { status: "over", result: "1/2-1/2", endReason: "agreed", drawOffer: null }
          : { drawOffer: you };
    const res = await db.update(challenges).set(next).where(and(eq(challenges.code, row.code), eq(challenges.moves, row.moves), eq(challenges.status, "active")));
    if (!res.rowsAffected) return fail(c, 409, "conflict");
    return c.json({ challenge: await view({ ...row, ...next }, you) });
  });

  /** A puzzle attempt: the creator's own (signed in) or the friend's (anyone with the link). The first answer stands. */
  app.post("/v1/challenges/:code/result", on("challenges"), async (c) => {
    if (!limiter(`result:${ipOf(c)}`)) return fail(c, 429, "rate_limited");
    const row = await findChallenge(c.req.param("code") ?? "");
    const b = await json(c);
    if (!row || row.kind !== "puzzle") return fail(c, 404, "not_found");
    if (typeof b.solved !== "boolean") return fail(c, 400, "invalid_input");
    if (row.expiresAt <= now().getTime()) return fail(c, 410, "expired");
    const mine = (await userFromRequest(c))?.id === row.creatorId;
    const value = b.solved ? "solved" : "missed";
    const col = mine ? challenges.creatorResult : challenges.friendResult;
    await db.update(challenges).set(mine ? { creatorResult: value } : { friendResult: value }).where(and(eq(challenges.code, row.code), sql`${col} is null`));
    const fresh = (await findChallenge(row.code)) ?? row;
    return c.json({ challenge: await view(fresh, mine ? "w" : null) });
  });

  /* ---------- invites ---------- */

  app.get("/v1/invites/mine", on("invites"), requireUser, async (c) => {
    const user = c.get("user");
    const at = now().getTime();
    let mine = await db.query.invites.findFirst({ where: eq(invites.userId, user.id) });
    if (!mine) {
      await db.insert(invites).values({ code: newCode(), userId: user.id, createdAt: at }).onConflictDoNothing();
      mine = await db.query.invites.findFirst({ where: eq(invites.userId, user.id) });
    }
    const [paid] = await db
      .select({ n: sql<number>`count(*)` })
      .from(inviteAccepts)
      .where(and(eq(inviteAccepts.inviterId, user.id), eq(inviteAccepts.inviterRewarded, true), gte(inviteAccepts.rewardedAt, at - 30 * DAY)));
    const bank = await db.query.freezeBank.findFirst({ where: eq(freezeBank.userId, user.id) });
    return c.json({ code: mine!.code, url: `${SHARE_ORIGIN}/i/${mine!.code}`, rewards: Number(paid?.n ?? 0), cap: INVITE_MONTHLY_CAP, banked: bank?.banked ?? 0 });
  });

  /** For the /i/<code> page: who invited you (first name only). */
  app.get("/v1/invites/:code", on("invites"), async (c) => {
    const code = c.req.param("code") ?? "";
    const row = CODE.test(code) ? await db.query.invites.findFirst({ where: eq(invites.code, code) }) : null;
    const inviter = row ? await db.query.users.findFirst({ where: eq(users.id, row.userId) }) : null;
    return inviter ? c.json({ code, name: firstName(inviter.name) }) : fail(c, 404, "not_found");
  });

  /** The signed-in friend accepts an invite: once per account, never their own, and only before they have earned it another way. */
  app.post("/v1/invites/accept", on("invites"), requireUser, async (c) => {
    const user = c.get("user");
    const code = String((await json(c)).code ?? "");
    const row = CODE.test(code) ? await db.query.invites.findFirst({ where: eq(invites.code, code) }) : null;
    if (!row) return fail(c, 404, "not_found");
    if (row.userId === user.id) return fail(c, 400, "invalid_input");
    const res = await db.insert(inviteAccepts).values({ invitedId: user.id, inviterId: row.userId, createdAt: now().getTime() }).onConflictDoNothing();
    return c.json({ ok: true, accepted: Boolean(res.rowsAffected) });
  });

  /**
   * Moves banked freezes into the learner's streak. `have` is how many freezes the streak holds now;
   * the streak never holds more than FREEZE_MAX, so the rest stays banked for later.
   */
  app.post("/v1/invites/claim", on("invites"), requireUser, async (c) => {
    const user = c.get("user");
    const have = Number((await json(c)).have);
    if (!Number.isInteger(have) || have < 0 || have > FREEZE_MAX) return fail(c, 400, "invalid_input");
    const bank = await db.query.freezeBank.findFirst({ where: eq(freezeBank.userId, user.id) });
    const give = Math.min(bank?.banked ?? 0, FREEZE_MAX - have);
    if (give <= 0) return c.json({ freezes: 0, banked: bank?.banked ?? 0 });
    // Only succeeds against the balance we read, so two devices cannot both take it.
    const res = await db.update(freezeBank).set({ banked: bank!.banked - give }).where(and(eq(freezeBank.userId, user.id), eq(freezeBank.banked, bank!.banked)));
    if (!res.rowsAffected) return c.json({ freezes: 0, banked: bank!.banked });
    return c.json({ freezes: give, banked: bank!.banked - give });
  });
}
