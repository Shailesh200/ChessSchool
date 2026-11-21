import { copy, palettes, setLanguage, type Lang } from "@chessschool/design";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
import type { Context, Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Db } from "./db";
import { isQaEmail } from "./qa-accounts";
import { progress, users, weeklySummary } from "./schema";
import type { Sender } from "./weekly";

/**
 * Lifecycle emails: a welcome on sign-up, one "we miss you" after a week away (at most once a month),
 * and the unsubscribe link and settings for these and the weekly summary.
 *
 * Who gets them: accounts with an email that are full members. Guest accounts and QA test mailboxes
 * never do. Child profiles (cs_children) live inside a parent's account and have no address of their
 * own, so a child never receives anything; the parent account is the only recipient.
 */

export const emailPrefs = sqliteTable("cs_email_prefs", {
  userId: text("user_id").primaryKey(),
  winback: integer("winback", { mode: "boolean" }).notNull().default(true),
  /** Set by an "all" unsubscribe: nothing lifecycle goes out until Settings turns a type back on. */
  allOff: integer("all_off", { mode: "boolean" }).notNull().default(false),
  lang: text("lang"),
  welcomeAt: integer("welcome_at"),
  winbackAt: integer("winback_at"),
});

/** Emails sent per UTC day across every kind, to stay under the email plan's daily allowance. */
export const emailDays = sqliteTable("cs_email_days", {
  day: text("day").primaryKey(),
  sent: integer("sent").notNull().default(0),
});


const DAY = 86_400_000;
/** Resend's free plan allows 100 a day; keep a little room for password and support mail. */
export const EMAIL_DAY_CAP = 95;
export const WINBACK_AFTER_DAYS = 7;
export const WINBACK_EVERY_DAYS = 30;
/** Accounts away longer than this are left alone: a stale address is how a sender gets marked as spam. */
export const WINBACK_GIVE_UP_DAYS = 90;
/** The cron sends a welcome that the sign-up request could not (Resend down, timeout) for this long. */
const WELCOME_CATCHUP_MS = 3 * DAY;

export type EmailKind = "welcome" | "winback" | "weekly";
export type UnsubKind = "winback" | "weekly" | "all";
const UNSUB_KINDS = new Set<UnsubKind>(["winback", "weekly", "all"]);

/* ---------- unsubscribe tokens ---------- */

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const sign = (secret: string, payload: string) => createHmac("sha256", secret).update(`unsub:${payload}`).digest("base64url").slice(0, 32);

/** `<base64url(userId.kind)>.<hmac>`: no expiry, so a link in an old email still works. */
export function unsubToken(secret: string, userId: string, kind: UnsubKind): string {
  const payload = b64(`${userId}.${kind}`);
  return `${payload}.${sign(secret, payload)}`;
}

export function readUnsubToken(secret: string, token: string): { userId: string; kind: UnsubKind } | null {
  const [payload, mac, extra] = token.split(".");
  if (!payload || !mac || extra !== undefined) return null;
  const want = Buffer.from(sign(secret, payload));
  const got = Buffer.from(mac);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const [userId, kind] = Buffer.from(payload, "base64url").toString().split(".");
  return userId && UNSUB_KINDS.has(kind as UnsubKind) ? { userId, kind: kind as UnsubKind } : null;
}

/* ---------- messages ---------- */

const esc = (v: string) => v.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);
export const MASCOT_URL = "https://www.chess-school.in/assets/raster/pwa-192.png";
export const APP_URL = "https://www.chess-school.in";

export type Message = { subject: string; html: string; text: string; headers: Record<string, string> };

/** The words of one email in `lang`. setLanguage is synchronous, so no other request sees the switch. */
function words<T>(lang: Lang, pick: () => T): T {
  setLanguage(lang);
  try {
    return pick();
  } finally {
    setLanguage("en");
  }
}

/** Branded HTML with a plain-text twin. Inline styles only: mail clients drop <style> blocks. */
export function layout(p: { lang: Lang; subject: string; heading: string; lines: string[]; cta: string; why: string; unsubscribeUrl: string; unsubscribeLabel: string }): Message {
  const c = palettes.light;
  const html = `<!doctype html><html lang="${p.lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${esc(p.subject)}</title></head>
<body style="margin:0;background:${c.bg};font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:${c.text}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${c.bg}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:${c.card};border-radius:20px">
<tr><td style="padding:28px 28px 8px;text-align:center"><img src="${MASCOT_URL}" width="72" height="72" alt="${esc(words(p.lang, () => copy.a11y.mascot))}" style="border-radius:18px"></td></tr>
<tr><td style="padding:8px 28px 0"><h1 style="margin:0;font-size:22px;line-height:1.3;color:${c.brandText};text-align:center">${esc(p.heading)}</h1></td></tr>
<tr><td style="padding:12px 28px 4px;font-size:16px;line-height:1.6">${p.lines.map((l) => `<p style="margin:0 0 10px">${esc(l)}</p>`).join("")}</td></tr>
<tr><td align="center" style="padding:8px 28px 28px"><a href="${APP_URL}" style="display:inline-block;background:${c.brand};color:${c.onBrand};text-decoration:none;font-weight:700;padding:14px 24px;border-radius:14px;font-size:16px">${esc(p.cta)}</a></td></tr>
</table>
<p style="max-width:480px;margin:16px auto 0;font-size:13px;line-height:1.5;color:${c.textMuted}">${esc(p.why)} <a href="${esc(p.unsubscribeUrl)}" style="color:${c.textMuted}">${esc(p.unsubscribeLabel)}</a></p>
</td></tr></table></body></html>`;
  const text = `${p.heading}\n\n${p.lines.join("\n")}\n\n${p.cta}: ${APP_URL}\n\n--\n${p.why}\n${p.unsubscribeLabel}: ${p.unsubscribeUrl}\n`;
  return { subject: p.subject, html, text, headers: unsubHeaders(p.unsubscribeUrl) };
}

/** RFC 8058 one-click unsubscribe: mail apps POST to the same link. */
export const unsubHeaders = (url: string) => ({ "List-Unsubscribe": `<${url}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" });

export function welcomeMessage(name: string, lang: Lang, unsubscribeUrl: string): Message {
  const w = words(lang, () => ({ ...copy.platform.email, why: copy.platform.email.why.welcome, heading: copy.platform.email.welcomeHeading(name.split(/\s+/)[0] ?? "") }));
  return layout({ lang, subject: w.welcomeSubject, heading: w.heading, lines: [...w.welcomeLines], cta: w.welcomeCta, why: w.why, unsubscribeUrl, unsubscribeLabel: w.unsubscribeAll });
}

export function winbackMessage(next: string | null, streak: number, lang: Lang, unsubscribeUrl: string): Message {
  const w = words(lang, () => ({ ...copy.platform.email, lines: copy.platform.email.winbackLines(next, streak), why: copy.platform.email.why.winback }));
  return layout({ lang, subject: w.winbackSubject, heading: w.winbackHeading, lines: w.lines, cta: w.winbackCta, why: w.why, unsubscribeUrl, unsubscribeLabel: w.unsubscribe });
}

/* ---------- who may be emailed ---------- */

type UserRow = typeof users.$inferSelect;
export const emailable = (u: Pick<UserRow, "email" | "kind">) => u.kind === "member" && /@/.test(u.email) && !isQaEmail(u.email);

export const langOf = (v: unknown): Lang => (v === "hi" ? "hi" : "en");
/** The language a request asks for: the app's own header first, then the browser's. */
export const requestLang = (c: Context): Lang => {
  const own = c.req.header("x-cs-lang");
  if (own) return langOf(own);
  return c.req.header("accept-language")?.toLowerCase().startsWith("hi") ? "hi" : "en";
};

/** Takes one slot of today's email allowance; false when the day is used up. */
export async function takeEmailSlot(db: Db, nowMs: number, cap = EMAIL_DAY_CAP): Promise<boolean> {
  const day = new Date(nowMs).toISOString().slice(0, 10);
  const rows = await db.all<{ sent: number }>(sql`INSERT INTO cs_email_days (day, sent) VALUES (${day}, 1) ON CONFLICT(day) DO UPDATE SET sent = sent + 1 WHERE sent < ${cap} RETURNING sent`);
  return rows.length > 0;
}

/* ---------- routes ---------- */

type Guard = (c: Context<{ Variables: { user: UserRow } }>, next: () => Promise<void>) => Promise<unknown>;
export type LifecycleDeps = {
  db: Db;
  now: () => Date;
  requireUser: Guard;
  sender?: Sender;
  cronSecret?: string;
  /** HMAC key for unsubscribe links. Without one, lifecycle email is off (the routes still answer). */
  secret: string | null;
  /** Public origin of this API, for unsubscribe links. */
  apiOrigin: string;
  /** Next unit title and best streak for the winback email. */
  nextUp: (userId: string, lang: Lang) => Promise<{ next: string | null; streak: number }>;
};

export function mountLifecycle(app: Hono<{ Variables: { user: UserRow } }>, deps: LifecycleDeps) {
  const { db, now, requireUser, sender, cronSecret, secret, apiOrigin, nextUp } = deps;
  const unsubUrl = (userId: string, kind: UnsubKind) => `${apiOrigin.replace(/\/$/, "")}/v1/email/unsubscribe?t=${encodeURIComponent(unsubToken(secret!, userId, kind))}`;

  const prefsOf = async (userId: string) => (await db.select().from(emailPrefs).where(eq(emailPrefs.userId, userId)).get()) ?? null;
  const upsert = (userId: string, set: Partial<typeof emailPrefs.$inferInsert>) =>
    db.insert(emailPrefs).values({ userId, ...set }).onConflictDoUpdate({ target: emailPrefs.userId, set });

  async function send(to: string, m: Message): Promise<boolean> {
    if (!sender || !(await takeEmailSlot(db, now().getTime()))) return false;
    return sender.email(to, m.subject, m.html, m.text, m.headers).catch(() => false);
  }

  /** Sends the welcome once. The first request to claim welcome_at sends it; a failed send frees the claim for the cron. */
  async function welcome(user: UserRow, lang: Lang): Promise<boolean> {
    if (!secret || !sender || !emailable(user)) return false;
    const at = now().getTime();
    await db.insert(emailPrefs).values({ userId: user.id, lang }).onConflictDoNothing();
    const claimed = await db.update(emailPrefs).set({ welcomeAt: at }).where(and(eq(emailPrefs.userId, user.id), sql`${emailPrefs.welcomeAt} is null`, eq(emailPrefs.allOff, false)));
    if (!claimed.rowsAffected) return false;
    const ok = await send(user.email, welcomeMessage(user.name, lang, unsubUrl(user.id, "all")));
    if (!ok) await db.update(emailPrefs).set({ welcomeAt: null }).where(eq(emailPrefs.userId, user.id));
    return ok;
  }

  // Welcome on sign-up: after a successful register / Google / Apple sign-in that created the account just now.
  app.use("/v1/auth/:provider{register|google|apple}", async (c, next) => {
    await next();
    if (!secret || !sender || c.res.status >= 300) return;
    try {
      const body = (await c.res.clone().json()) as { user?: { id?: string } };
      const id = body.user?.id;
      const user = id ? await db.query.users.findFirst({ where: eq(users.id, id) }) : undefined;
      if (!user || now().getTime() - user.createdAt > 5 * 60_000) return;
      // A slow email provider must not hold up sign-up for long; the cron sends what this misses.
      await Promise.race([welcome(user, requestLang(c)), new Promise((r) => setTimeout(r, 3000))]);
    } catch {
      /* the cron catches up */
    }
  });

  app.get("/v1/me/emails", requireUser, async (c) => {
    const user = c.get("user");
    const [p, w] = await Promise.all([prefsOf(user.id), db.query.weeklySummary.findFirst({ where: eq(weeklySummary.userId, user.id) })]);
    return c.json({ winback: !p?.allOff && (p?.winback ?? true), weekly: Boolean(w?.email), eligible: emailable(user) });
  });

  /** Body: { winback?: boolean, lang?: "en" | "hi" }. The weekly switch keeps its own route (PUT /v1/me/weekly). */
  app.put("/v1/me/emails", requireUser, async (c) => {
    const user = c.get("user");
    const b = (await c.req.json().catch(() => ({}))) as { winback?: unknown; lang?: unknown };
    if (b.winback !== undefined && typeof b.winback !== "boolean") return c.json({ error: "invalid_input" }, 400);
    const set: Partial<typeof emailPrefs.$inferInsert> = {};
    if (typeof b.winback === "boolean") Object.assign(set, { winback: b.winback, ...(b.winback ? { allOff: false } : {}) });
    if (b.lang !== undefined) set.lang = langOf(b.lang);
    if (Object.keys(set).length) await upsert(user.id, set);
    const p = await prefsOf(user.id);
    return c.json({ winback: !p?.allOff && (p?.winback ?? true) });
  });

  /* Unsubscribe: GET shows a page with one button (link scanners only GET, so they can't unsubscribe anyone);
     POST does it, from that button or from a mail app's one-click (List-Unsubscribe-Post). */
  const page = (lang: Lang, title: string, body: string, form?: { token: string; button: string }) => {
    const c = palettes.light;
    return `<!doctype html><html lang="${lang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)}</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:${c.bg};color:${c.text};font-family:system-ui,-apple-system,'Segoe UI',sans-serif">
<main style="max-width:420px;margin:24px 16px;padding:28px;background:${c.card};border-radius:20px;text-align:center">
<img src="${MASCOT_URL}" width="64" height="64" alt="" style="border-radius:16px">
<h1 style="font-size:22px;color:${c.brandText}">${esc(title)}</h1><p style="line-height:1.6">${esc(body)}</p>
${form ? `<form method="post"><input type="hidden" name="t" value="${esc(form.token)}"><button type="submit" style="min-height:48px;padding:12px 24px;border:0;border-radius:14px;background:${c.brand};color:${c.onBrand};font-size:16px;font-weight:700;cursor:pointer">${esc(form.button)}</button></form>` : ""}
</main></body></html>`;
  };

  app.get("/v1/email/unsubscribe", async (c) => {
    const lang = requestLang(c);
    const t = c.req.query("t") ?? "";
    const parsed = secret ? readUnsubToken(secret, t) : null;
    const u = words(lang, () => copy.platform.unsubscribe);
    if (!parsed) return c.html(page(lang, u.title, u.invalid), 400);
    return c.html(page(lang, u.title, u.body[parsed.kind], { token: t, button: u.confirm }));
  });

  app.post("/v1/email/unsubscribe", async (c) => {
    const lang = requestLang(c);
    let t = c.req.query("t") ?? "";
    if (!t) {
      const form = await c.req.parseBody().catch(() => ({}) as Record<string, unknown>);
      t = typeof form.t === "string" ? form.t : "";
    }
    const parsed = secret ? readUnsubToken(secret, t) : null;
    const u = words(lang, () => copy.platform.unsubscribe);
    if (!parsed) return c.html(page(lang, u.title, u.invalid), 400);
    const { userId, kind } = parsed;
    if (kind === "winback" || kind === "all") await upsert(userId, kind === "all" ? { allOff: true, winback: false } : { winback: false });
    if (kind === "weekly" || kind === "all") await db.update(weeklySummary).set({ email: false }).where(eq(weeklySummary.userId, userId));
    return c.html(page(lang, u.doneTitle, u.doneBody));
  });

  /** Daily (called from the weekly cron, or on its own): missed welcomes, then come-back emails. */
  async function runLifecycle() {
    const out = { welcome: 0, winback: 0 };
    if (!secret || !sender) return out;
    const at = now().getTime();
    const fresh = await db
      .select({ user: users, welcomeAt: emailPrefs.welcomeAt, lang: emailPrefs.lang })
      .from(users)
      .leftJoin(emailPrefs, eq(emailPrefs.userId, users.id))
      .where(and(gte(users.createdAt, at - WELCOME_CATCHUP_MS), sql`${emailPrefs.welcomeAt} is null`, sql`coalesce(${emailPrefs.allOff}, 0) = 0`))
      .limit(50);
    for (const r of fresh) if (await welcome(r.user, langOf(r.lang))) out.welcome++;

    // Away a week (but not too long), come-back reminders on, and not reminded in the last month or since they were last here.
    const away = await db
      .select({ user: users, last: progress.updatedAt, lang: emailPrefs.lang, weeklyLang: weeklySummary.lang, winbackAt: emailPrefs.winbackAt })
      .from(progress)
      .innerJoin(users, eq(users.id, progress.userId))
      .leftJoin(emailPrefs, eq(emailPrefs.userId, users.id))
      .leftJoin(weeklySummary, eq(weeklySummary.userId, users.id))
      .where(
        and(
          lt(progress.updatedAt, at - WINBACK_AFTER_DAYS * DAY),
          gte(progress.updatedAt, at - WINBACK_GIVE_UP_DAYS * DAY),
          sql`coalesce(${emailPrefs.winback}, 1) = 1`,
          sql`coalesce(${emailPrefs.allOff}, 0) = 0`,
          sql`(${emailPrefs.winbackAt} is null or (${emailPrefs.winbackAt} < ${at - WINBACK_EVERY_DAYS * DAY} and ${emailPrefs.winbackAt} < ${progress.updatedAt}))`,
        ),
      )
      .limit(50);
    for (const r of away) {
      if (!emailable(r.user)) continue;
      const lang = langOf(r.lang ?? r.weeklyLang);
      const { next, streak } = await nextUp(r.user.id, lang);
      if (!(await send(r.user.email, winbackMessage(next, streak, lang, unsubUrl(r.user.id, "winback"))))) continue;
      await upsert(r.user.id, { winbackAt: at });
      out.winback++;
    }
    return out;
  }

  app.get("/v1/cron/lifecycle", async (c) => {
    if (!cronSecret || c.req.header("authorization") !== `Bearer ${cronSecret}`) return c.json({ error: "not_found" }, 404);
    return c.json(await runLifecycle());
  });

  return { runLifecycle, unsubUrl: (userId: string, kind: UnsubKind) => (secret ? unsubUrl(userId, kind) : null), takeSlot: () => takeEmailSlot(db, now().getTime()) };
}

/** Rows to delete with an account. */
export const lifecycleDeletes = (db: Db, userId: string) => [db.delete(emailPrefs).where(eq(emailPrefs.userId, userId))];
