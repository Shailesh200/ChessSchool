import {
  checkDetails,
  emptyDetails,
  firstName,
  isAvatarId,
  isCountry,
  PLAYER_REPORT_REASONS,
  sanitizeRatings,
  SUPPORT_TOPICS,
  validEmail,
  type BlockedPlayer,
  type MyDetails,
  type PlayerProfile,
  type PlayerReportReason,
  type ProfileDetails,
  type SafetyAction,
  type SafetyReport,
  type SupportMessage,
  type SupportTopic,
} from "@chessschool/design";
import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/sqlite-core";
import type { Context, Hono } from "hono";
import type { Db } from "./db";
import {
  blocks,
  challenges,
  childProgress,
  children,
  classes,
  classGames,
  classMembers,
  feedback,
  follows,
  inviteAccepts,
  invites,
  leagueMembers,
  profileDetails,
  profiles,
  progress,
  ratingHistory,
  ratings,
  reports,
  sessions,
  shares,
  supportMessages,
  suspensions,
  users,
  visionScores,
  weeklySummary,
} from "./schema";
import { createRateLimiter, newId } from "./security";
import type { Sender } from "./weekly";

/**
 * Phase 4: reporting and blocking players anywhere (not only in a class), public profiles with
 * details and an uploaded photo, add-friend-by-code, the admin safety queue, "Contact us" and data export.
 */

type UserRow = typeof users.$inferSelect;
type Vars = { Variables: { user: UserRow } };
type Guard = (c: Context<Vars>, next: () => Promise<void>) => Promise<unknown>;

/** Uploaded profile photos. Production uses R2 (same R2_* settings as share cards); tests pass an in-memory store. */
export type PhotoStore = { put: (key: string, bytes: Uint8Array, contentType: string) => Promise<string>; remove: (url: string) => Promise<void> };

export type SocialDeps = {
  db: Db;
  now: () => Date;
  requireUser: Guard;
  requireAdmin: Guard;
  userFromRequest: (c: Context) => Promise<UserRow | null>;
  photoStore?: PhotoStore | null;
  /** Emails support messages to the admins (Resend in production). */
  sender?: Sender;
  adminEmails: string[];
};

/** Distinct reporters with an open photo report before the photo is hidden pending review. */
export const PHOTO_HIDE_REPORTS = 2;
/** Upload cap after the device has downscaled the photo (512px JPEG is ~60 KB). */
export const PHOTO_MAX_BYTES = 400_000;
const CODE = /^[2-9a-z]{6,12}$/;
const IMAGE_TYPES = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;

const fail = (c: Context, status: number, error: string, message?: string) => c.json({ error, message }, status as 400);
async function json(c: Context): Promise<Record<string, unknown>> {
  try {
    const b = await c.req.json();
    return b && typeof b === "object" ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
const ipOf = (c: Context) => c.req.header("x-forwarded-for")?.split(",")[0]?.trim() || c.req.header("x-real-ip") || "local";
const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/* ---------- helpers used by other routes ---------- */

/** Everyone `userId` blocked or was blocked by: neither side sees the other. */
export async function blockedWith(db: Db, userId: string): Promise<Set<string>> {
  const rows = await db.select().from(blocks).where(or(eq(blocks.blockerId, userId), eq(blocks.blockedId, userId)));
  return new Set(rows.map((r) => (r.blockerId === userId ? r.blockedId : r.blockerId)));
}

export async function isBlockedBetween(db: Db, a: string, b: string): Promise<boolean> {
  const row = await db.query.blocks.findFirst({ where: or(and(eq(blocks.blockerId, a), eq(blocks.blockedId, b)), and(eq(blocks.blockerId, b), eq(blocks.blockedId, a))) });
  return Boolean(row);
}

export async function suspendedIds(db: Db): Promise<Set<string>> {
  return new Set((await db.select({ id: suspensions.userId }).from(suspensions)).map((r) => r.id));
}

export async function isSuspended(db: Db, userId: string): Promise<boolean> {
  return Boolean(await db.query.suspensions.findFirst({ where: eq(suspensions.userId, userId) }));
}

/** Visible uploaded photos by account id; accounts without one (or with a hidden one) are left out. */
export async function photosFor(db: Db, ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids)];
  if (!unique.length) return new Map();
  const rows = await db.select({ id: profileDetails.userId, photo: profileDetails.photo, hidden: profileDetails.photoHidden }).from(profileDetails).where(inArray(profileDetails.userId, unique));
  return new Map(rows.filter((r) => r.photo && !r.hidden).map((r) => [r.id, r.photo!]));
}

/** Friends both ways (invite links and friend codes). Nothing happens when either side blocked the other. */
export async function befriend(db: Db, a: string, b: string, at: number): Promise<boolean> {
  if (a === b || (await isBlockedBetween(db, a, b))) return false;
  await db.batch([db.insert(follows).values({ userId: a, friendId: b, createdAt: at }).onConflictDoNothing(), db.insert(follows).values({ userId: b, friendId: a, createdAt: at }).onConflictDoNothing()]);
  return true;
}

/** Rows to delete with an account (used by account-delete.ts). Their reports and blocks go with the cs_reports/cs_blocks deletes there. */
export const socialDeletes = (db: Db, userId: string) => [
  db.delete(profileDetails).where(eq(profileDetails.userId, userId)),
  db.delete(suspensions).where(eq(suspensions.userId, userId)),
  db.delete(supportMessages).where(eq(supportMessages.userId, userId)),
];

function readDetails(data: string | null | undefined): ProfileDetails {
  if (!data) return emptyDetails();
  try {
    const parsed = checkDetails(JSON.parse(data), emptyDetails(), 9999);
    return "details" in parsed ? parsed.details : emptyDetails();
  } catch {
    return emptyDetails();
  }
}

/* ---------- R2 ---------- */

export async function photoStoreFromEnv(env: NodeJS.ProcessEnv): Promise<PhotoStore | null> {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_PUBLIC_URL } = env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET || !R2_PUBLIC_URL) return null;
  const { DeleteObjectCommand, PutObjectCommand, S3Client } = await import("@aws-sdk/client-s3");
  const client = new S3Client({ region: "auto", endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } });
  const base = R2_PUBLIC_URL.replace(/\/$/, "");
  return {
    async put(key, bytes, contentType) {
      await client.send(new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, Body: bytes, ContentType: contentType, CacheControl: "public, max-age=31536000, immutable" }));
      return `${base}/${key}`;
    },
    async remove(url) {
      if (!url.startsWith(`${base}/`)) return;
      await client.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: url.slice(base.length + 1) }));
    },
  };
}

/** True when the bytes really are the image type claimed (magic numbers), so nothing else is stored as a photo. */
export function isImage(bytes: Uint8Array, type: keyof typeof IMAGE_TYPES): boolean {
  const at = (i: number, ...v: number[]) => v.every((b, k) => bytes[i + k] === b);
  if (type === "image/jpeg") return at(0, 0xff, 0xd8, 0xff);
  if (type === "image/png") return at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
  return at(0, 0x52, 0x49, 0x46, 0x46) && at(8, 0x57, 0x45, 0x42, 0x50);
}

/* ---------- routes ---------- */

export function mountSocial(app: Hono<Vars>, { db, now, requireUser, requireAdmin, userFromRequest, photoStore = null, sender, adminEmails }: SocialDeps) {
  const clock = () => now().getTime();
  const reportLimiter = createRateLimiter(10, 60 * 60_000, clock);
  const blockLimiter = createRateLimiter(30, 60 * 60_000, clock);
  const photoLimiter = createRateLimiter(10, 60 * 60_000, clock);
  const codeLimiter = createRateLimiter(10, 10 * 60_000, clock);
  const supportLimiter = createRateLimiter(5, 10 * 60_000, clock);
  const exportLimiter = createRateLimiter(5, 60 * 60_000, clock);

  /** A full account other people may see: a member, not suspended, not blocked either way. */
  async function visibleTo(viewerId: string, id: string): Promise<UserRow | null> {
    const u = id ? await db.query.users.findFirst({ where: eq(users.id, id) }) : null;
    if (!u || u.kind !== "member") return null;
    if (u.id === viewerId) return u;
    if ((await isSuspended(db, u.id)) || (await isBlockedBetween(db, viewerId, u.id))) return null;
    return u;
  }

  async function myDetails(userId: string): Promise<MyDetails> {
    const row = await db.query.profileDetails.findFirst({ where: eq(profileDetails.userId, userId) });
    return { details: readDetails(row?.data), photo: row?.photo ?? null, photoHidden: Boolean(row?.photo && row.photoHidden) };
  }

  async function saveRow(userId: string, set: Partial<typeof profileDetails.$inferInsert>) {
    const at = clock();
    await db
      .insert(profileDetails)
      .values({ userId, data: "{}", updatedAt: at, ...set })
      .onConflictDoUpdate({ target: profileDetails.userId, set: { ...set, updatedAt: at } });
  }

  async function block(me: string, other: string, at: number) {
    await db.batch([
      db.insert(blocks).values({ blockerId: me, blockedId: other, createdAt: at }).onConflictDoNothing(),
      db.delete(follows).where(or(and(eq(follows.userId, me), eq(follows.friendId, other)), and(eq(follows.userId, other), eq(follows.friendId, me)))),
    ]);
  }

  /** Hides the photo once PHOTO_HIDE_REPORTS people have an open photo report about it; shows it again when none are left open. */
  async function syncPhotoHold(userId: string) {
    const [open] = await db
      .select({ n: sql<number>`count(distinct ${reports.reporterId})` })
      .from(reports)
      .where(and(eq(reports.reportedId, userId), eq(reports.reason, "photo"), eq(reports.status, "open")));
    const hide = Number(open?.n ?? 0) >= PHOTO_HIDE_REPORTS;
    await db.update(profileDetails).set({ photoHidden: hide }).where(eq(profileDetails.userId, userId));
  }

  /* ----- public profile ----- */

  app.get("/v1/players/:id", requireUser, async (c) => {
    const me = c.get("user");
    const u = await visibleTo(me.id, c.req.param("id") ?? "");
    if (!u) return fail(c, 404, "not_found");
    const [profile, extra, rating, prog, friend, photo] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.userId, u.id) }),
      db.query.profileDetails.findFirst({ where: eq(profileDetails.userId, u.id) }),
      db.query.ratings.findFirst({ where: and(eq(ratings.learnerId, u.id), eq(ratings.userId, u.id)) }),
      db.query.progress.findFirst({ where: eq(progress.userId, u.id) }),
      db.query.follows.findFirst({ where: and(eq(follows.userId, me.id), eq(follows.friendId, u.id)) }),
      photosFor(db, [u.id]),
    ]);
    const details = readDetails(extra?.data);
    // A child learns on this account: no city and no links for strangers.
    if (profile?.who === "child" && u.id !== me.id) Object.assign(details, { city: "", socials: {} });
    const r = rating ? sanitizeRatings(JSON.parse(rating.data)) : null;
    let xp = 0;
    try {
      xp = Number((JSON.parse(prog?.data ?? "{}") as { xp?: unknown }).xp) || 0;
    } catch {}
    const player: PlayerProfile = {
      id: u.id,
      name: firstName(u.name) || "Player",
      avatar: isAvatarId(profile?.avatar) ? profile.avatar : "cody",
      photo: photo.get(u.id) ?? null,
      country: isCountry(profile?.country) ? profile.country : null,
      details,
      rating: r && r.player.games > 0 ? r.player.rating : null,
      xp,
      joinedAt: u.createdAt,
      friend: Boolean(friend),
      me: u.id === me.id,
    };
    return c.json({ player });
  });

  /* ----- report and block ----- */

  app.post("/v1/players/:id/report", requireUser, async (c) => {
    const me = c.get("user");
    if (!reportLimiter(me.id)) return fail(c, 429, "rate_limited");
    const b = await json(c);
    const reason = PLAYER_REPORT_REASONS.includes(b.reason as PlayerReportReason) ? (b.reason as PlayerReportReason) : null;
    const id = c.req.param("id") ?? "";
    if (!reason || id === me.id) return fail(c, 400, "invalid_input");
    // Reporting works even after a block, so look the account up directly.
    const target = await db.query.users.findFirst({ where: eq(users.id, id) });
    if (!target) return fail(c, 404, "not_found");
    const at = clock();
    const dup = await db.query.reports.findFirst({ where: and(eq(reports.reporterId, me.id), eq(reports.reportedId, id), eq(reports.reason, reason), eq(reports.status, "open")) });
    if (!dup) await db.insert(reports).values({ id: newId(), classId: "", reporterId: me.id, reportedId: id, reason, note: String(b.note ?? "").trim().slice(0, 500), status: "open", createdAt: at });
    if (b.block !== false) await block(me.id, id, at);
    if (reason === "photo") await syncPhotoHold(id);
    return c.json({ ok: true });
  });

  /** Report (and by default block) whoever sent a challenge link; the link itself never shows their account id. */
  app.post("/v1/challenges/:code/report", requireUser, async (c) => {
    const me = c.get("user");
    if (!reportLimiter(me.id)) return fail(c, 429, "rate_limited");
    const row = await db.query.challenges.findFirst({ where: eq(challenges.code, (c.req.param("code") ?? "").toLowerCase()) });
    if (!row) return fail(c, 404, "not_found");
    const b = await json(c);
    const reason = PLAYER_REPORT_REASONS.includes(b.reason as PlayerReportReason) ? (b.reason as PlayerReportReason) : null;
    if (!reason || row.creatorId === me.id) return fail(c, 400, "invalid_input");
    const at = clock();
    await db.insert(reports).values({ id: newId(), classId: "", reporterId: me.id, reportedId: row.creatorId, reason, note: `[challenge ${row.code}] ${String(b.note ?? "").trim()}`.slice(0, 500), status: "open", createdAt: at });
    if (b.block !== false) await block(me.id, row.creatorId, at);
    return c.json({ ok: true });
  });

  app.post("/v1/players/:id/block", requireUser, async (c) => {
    const me = c.get("user");
    if (!blockLimiter(me.id)) return fail(c, 429, "rate_limited");
    const id = c.req.param("id") ?? "";
    if (id === me.id) return fail(c, 400, "invalid_input");
    if (!(await db.query.users.findFirst({ where: eq(users.id, id) }))) return fail(c, 404, "not_found");
    await block(me.id, id, clock());
    return c.json({ ok: true });
  });

  app.delete("/v1/players/:id/block", requireUser, async (c) => {
    const me = c.get("user");
    await db.delete(blocks).where(and(eq(blocks.blockerId, me.id), eq(blocks.blockedId, c.req.param("id") ?? "")));
    return c.json({ ok: true });
  });

  app.get("/v1/me/blocks", requireUser, async (c) => {
    const me = c.get("user");
    const rows = await db
      .select({ id: blocks.blockedId, at: blocks.createdAt, name: users.name, avatar: profiles.avatar })
      .from(blocks)
      .leftJoin(users, eq(users.id, blocks.blockedId))
      .leftJoin(profiles, eq(profiles.userId, blocks.blockedId))
      .where(eq(blocks.blockerId, me.id))
      .orderBy(desc(blocks.createdAt));
    const blocked: BlockedPlayer[] = rows.map((r) => ({ id: r.id, name: firstName(r.name ?? "") || "Player", avatar: isAvatarId(r.avatar) ? r.avatar : "cody", at: r.at }));
    return c.json({ blocked });
  });

  /* ----- friends by code ----- */

  app.post("/v1/friends/code", requireUser, async (c) => {
    const me = c.get("user");
    if (!codeLimiter(me.id)) return fail(c, 429, "rate_limited");
    const code = String((await json(c)).code ?? "").trim().toLowerCase();
    const row = CODE.test(code) ? await db.query.invites.findFirst({ where: eq(invites.code, code) }) : null;
    if (!row) return fail(c, 404, "not_found");
    if (row.userId === me.id) return fail(c, 409, "conflict");
    const other = await visibleTo(me.id, row.userId);
    if (!other || !(await befriend(db, me.id, other.id, clock()))) return fail(c, 404, "not_found");
    return c.json({ ok: true, friend: { id: other.id, name: firstName(other.name) || "Player" } });
  });

  /* ----- your details and photo ----- */

  app.get("/v1/me/details", requireUser, async (c) => c.json(await myDetails(c.get("user").id)));

  app.put("/v1/me/details", requireUser, async (c) => {
    const me = c.get("user");
    const current = await myDetails(me.id);
    const checked = checkDetails(await json(c), current.details, now().getUTCFullYear());
    if ("problem" in checked) return fail(c, 400, "invalid_input", `${checked.problem.field}:${checked.problem.reason}`);
    await saveRow(me.id, { data: JSON.stringify(checked.details) });
    return c.json(await myDetails(me.id));
  });

  app.post("/v1/me/photo", requireUser, async (c) => {
    const me = c.get("user");
    if (!photoStore) return fail(c, 503, "unavailable");
    if (!photoLimiter(me.id)) return fail(c, 429, "rate_limited");
    const b = await json(c);
    const type = typeof b.mediaType === "string" && b.mediaType in IMAGE_TYPES ? (b.mediaType as keyof typeof IMAGE_TYPES) : null;
    if (!type || typeof b.image !== "string" || b.image.length > Math.ceil((PHOTO_MAX_BYTES * 4) / 3) + 4) return fail(c, 400, "invalid_input");
    const bytes = new Uint8Array(Buffer.from(b.image, "base64"));
    if (bytes.length < 100 || bytes.length > PHOTO_MAX_BYTES || !isImage(bytes, type)) return fail(c, 400, "invalid_input");
    const before = await db.query.profileDetails.findFirst({ where: eq(profileDetails.userId, me.id) });
    const url = await photoStore.put(`avatars/${me.id}/${newId()}.${IMAGE_TYPES[type]}`, bytes, type);
    await saveRow(me.id, { photo: url, photoHidden: false });
    if (before?.photo) await photoStore.remove(before.photo).catch(() => {});
    return c.json(await myDetails(me.id));
  });

  app.delete("/v1/me/photo", requireUser, async (c) => {
    const me = c.get("user");
    const before = await db.query.profileDetails.findFirst({ where: eq(profileDetails.userId, me.id) });
    await saveRow(me.id, { photo: null, photoHidden: false });
    if (before?.photo && photoStore) await photoStore.remove(before.photo).catch(() => {});
    return c.json(await myDetails(me.id));
  });

  /* ----- contact us ----- */

  app.post("/v1/support", async (c) => {
    const user = await userFromRequest(c);
    if (!supportLimiter(user?.id ?? ipOf(c))) return fail(c, 429, "rate_limited");
    const b = await json(c);
    const topic = SUPPORT_TOPICS.includes(b.topic as SupportTopic) ? (b.topic as SupportTopic) : null;
    const message = typeof b.message === "string" ? b.message.trim().slice(0, 4000) : "";
    const typed = typeof b.email === "string" ? b.email.trim().toLowerCase().slice(0, 200) : "";
    if (typed && !validEmail(typed)) return fail(c, 400, "invalid_input", "email");
    const email = typed || user?.email || null;
    // A guest has no account email, so they must leave one to get a reply.
    if (!topic || message.length < 10 || !email) return fail(c, 400, "invalid_input");
    const row = {
      id: newId(),
      userId: user?.id ?? null,
      guestId: typeof b.guestId === "string" ? b.guestId.slice(0, 64) : null,
      email,
      topic,
      message,
      platform: String(b.platform ?? "unknown").slice(0, 20),
      version: String(b.version ?? "").slice(0, 20),
      emailed: false,
      createdAt: clock(),
    };
    await db.insert(supportMessages).values(row);
    if (sender && adminEmails.length) {
      const subject = `ChessSchool support: ${topic} (${row.platform} ${row.version})`;
      const lines = [`From: ${email}${user ? ` (account ${user.id})` : " (guest)"}`, `Topic: ${topic}`, `App: ${row.platform} ${row.version}`, "", message];
      const html = `<div style="font-family:system-ui,sans-serif;white-space:pre-wrap">${esc(lines.join("\n"))}</div>`;
      let sent = false;
      for (const to of adminEmails) sent = (await sender.email(to, subject, html, lines.join("\n")).catch(() => false)) || sent;
      if (sent) await db.update(supportMessages).set({ emailed: true }).where(eq(supportMessages.id, row.id));
    }
    return c.json({ ok: true });
  });

  /* ----- download my data ----- */

  app.get("/v1/me/export", requireUser, async (c) => {
    const me = c.get("user");
    if (!exportLimiter(me.id)) return fail(c, 429, "rate_limited");
    const parse = (v: string | null | undefined) => {
      try {
        return v ? JSON.parse(v) : null;
      } catch {
        return v;
      }
    };
    const kids = await db.select().from(children).where(eq(children.userId, me.id));
    const kidIds = kids.map((k) => k.id);
    const [profile, details, prog, rate, history, kidProgress, memberships, games, made, friendsOut, friendsIn, blocked, reported, notes, support, league, vision, weekly, invite, invited, cards] = await Promise.all([
      db.query.profiles.findFirst({ where: eq(profiles.userId, me.id) }),
      myDetails(me.id),
      db.query.progress.findFirst({ where: eq(progress.userId, me.id) }),
      db.select().from(ratings).where(eq(ratings.userId, me.id)),
      db.select().from(ratingHistory).where(eq(ratingHistory.userId, me.id)),
      kidIds.length ? db.select().from(childProgress).where(inArray(childProgress.childId, kidIds)) : Promise.resolve([]),
      db.select({ classId: classMembers.classId, role: classMembers.role, joinedAt: classMembers.joinedAt, name: classes.name }).from(classMembers).leftJoin(classes, eq(classes.id, classMembers.classId)).where(eq(classMembers.userId, me.id)),
      db.select().from(classGames).where(or(eq(classGames.whiteId, me.id), eq(classGames.blackId, me.id))),
      db.select().from(challenges).where(eq(challenges.creatorId, me.id)),
      db.select({ id: follows.friendId, at: follows.createdAt, name: users.name }).from(follows).leftJoin(users, eq(users.id, follows.friendId)).where(eq(follows.userId, me.id)),
      db.select({ id: follows.userId, at: follows.createdAt }).from(follows).where(eq(follows.friendId, me.id)),
      db.select().from(blocks).where(eq(blocks.blockerId, me.id)),
      db.select({ id: reports.id, reportedId: reports.reportedId, reason: reports.reason, note: reports.note, status: reports.status, createdAt: reports.createdAt }).from(reports).where(eq(reports.reporterId, me.id)),
      db.select().from(feedback).where(eq(feedback.userId, me.id)),
      db.select().from(supportMessages).where(eq(supportMessages.userId, me.id)),
      db.select().from(leagueMembers).where(eq(leagueMembers.userId, me.id)),
      db.select().from(visionScores).where(eq(visionScores.userId, me.id)),
      db.query.weeklySummary.findFirst({ where: eq(weeklySummary.userId, me.id) }),
      db.query.invites.findFirst({ where: eq(invites.userId, me.id) }),
      db.select().from(inviteAccepts).where(or(eq(inviteAccepts.invitedId, me.id), eq(inviteAccepts.inviterId, me.id))),
      db.select().from(shares).where(eq(shares.userId, me.id)),
    ]);
    const data = {
      exportedAt: now().toISOString(),
      account: { id: me.id, email: me.email, name: me.name, createdAt: me.createdAt, signIn: me.passwordHash ? "password" : me.googleSub ? "google" : "apple" },
      profile: profile ?? null,
      details,
      progress: parse(prog?.data),
      ratings: rate.map((r) => ({ learnerId: r.learnerId, ratings: parse(r.data), updatedAt: r.updatedAt })),
      ratingHistory: history,
      children: kids.map((k) => ({ ...k, progress: parse(kidProgress.find((p) => p.childId === k.id)?.data) })),
      classes: memberships,
      classGames: games,
      challenges: made.map(({ blackSeat: _seat, ...rest }) => rest),
      friends: friendsOut.map((f) => ({ id: f.id, name: firstName(f.name ?? ""), since: f.at })),
      friendOf: friendsIn.map((f) => ({ id: f.id, since: f.at })),
      blocked: blocked.map((b) => ({ id: b.blockedId, at: b.createdAt })),
      reportsMade: reported,
      feedback: notes,
      support,
      leagues: league,
      visionScores: vision,
      // The push token is a device secret, so only whether reminders are on.
      weeklySummary: weekly ? { email: weekly.email, push: Boolean(weekly.pushToken), lang: weekly.lang } : null,
      invite: invite ? { code: invite.code, createdAt: invite.createdAt } : null,
      invites: invited,
      shareCards: cards,
    };
    c.header("Content-Disposition", `attachment; filename="chessschool-data-${now().toISOString().slice(0, 10)}.json"`);
    c.header("Cache-Control", "no-store");
    return c.json(data);
  });

  /* ----- admin safety queue ----- */

  app.get("/v1/admin/safety", requireAdmin, async (c) => {
    const reporter = alias(users, "reporter");
    const rows = await db
      .select({ id: reports.id, reason: reports.reason, note: reports.note, status: reports.status, createdAt: reports.createdAt, className: classes.name, reportedId: reports.reportedId, reported: users.name, reporter: reporter.name, photo: profileDetails.photo })
      .from(reports)
      .leftJoin(classes, eq(classes.id, reports.classId))
      .leftJoin(users, eq(users.id, reports.reportedId))
      .leftJoin(reporter, eq(reporter.id, reports.reporterId))
      .leftJoin(profileDetails, eq(profileDetails.userId, reports.reportedId))
      .orderBy(desc(reports.createdAt))
      .limit(300);
    const paused = await suspendedIds(db);
    const openCount = new Map<string, number>();
    for (const r of rows) if (r.status === "open") openCount.set(r.reportedId, (openCount.get(r.reportedId) ?? 0) + 1);
    const out: SafetyReport[] = rows.map((r) => ({
      id: r.id,
      reason: r.reason,
      note: r.note,
      status: r.status === "open" ? "open" : "resolved",
      createdAt: r.createdAt,
      className: r.className,
      reportedId: r.reportedId,
      reported: r.reported,
      reportedPhoto: r.photo,
      reportedSuspended: paused.has(r.reportedId),
      reporter: r.reporter,
      openAboutThem: openCount.get(r.reportedId) ?? 0,
    }));
    const msgs = await db.select({ m: supportMessages, name: users.name }).from(supportMessages).leftJoin(users, eq(users.id, supportMessages.userId)).orderBy(desc(supportMessages.createdAt)).limit(100);
    const support: SupportMessage[] = msgs.map(({ m, name }) => ({ id: m.id, topic: m.topic as SupportTopic, message: m.message, email: m.email, platform: m.platform, version: m.version, createdAt: m.createdAt, account: name }));
    return c.json({ reports: out, support });
  });

  const ACTIONS = new Set<SafetyAction>(["dismiss", "hide_name", "hide_photo", "suspend", "unsuspend", "reopen"]);
  app.post("/v1/admin/safety/reports/:id", requireAdmin, async (c) => {
    const action = (await json(c)).action as SafetyAction;
    if (!ACTIONS.has(action)) return fail(c, 400, "invalid_input");
    const report = await db.query.reports.findFirst({ where: eq(reports.id, c.req.param("id") ?? "") });
    if (!report) return fail(c, 404, "not_found");
    const who = report.reportedId;
    const resolve = db.update(reports).set({ status: "resolved" }).where(eq(reports.id, report.id));
    if (action === "reopen") await db.update(reports).set({ status: "open" }).where(eq(reports.id, report.id));
    else if (action === "dismiss") await resolve;
    else if (action === "hide_name") await db.batch([db.update(users).set({ name: "" }).where(eq(users.id, who)), resolve]);
    else if (action === "hide_photo") {
      const row = await db.query.profileDetails.findFirst({ where: eq(profileDetails.userId, who) });
      // Every open photo report about them is answered by removing it.
      await db.batch([
        db.update(profileDetails).set({ photo: null, photoHidden: false }).where(eq(profileDetails.userId, who)),
        db.update(reports).set({ status: "resolved" }).where(and(eq(reports.reportedId, who), eq(reports.reason, "photo"))),
        resolve,
      ]);
      if (row?.photo && photoStore) await photoStore.remove(row.photo).catch(() => {});
    } else if (action === "suspend") {
      await db.batch([db.insert(suspensions).values({ userId: who, reportId: report.id, createdAt: clock() }).onConflictDoNothing(), db.delete(sessions).where(eq(sessions.userId, who)), resolve]);
    } else if (action === "unsuspend") await db.delete(suspensions).where(eq(suspensions.userId, who));
    if (report.reason === "photo" && action !== "hide_photo") await syncPhotoHold(who);
    return c.json({ ok: true });
  });
}
