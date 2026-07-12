import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, profiles, progress, lessonRecords, oauthAccounts, analyticsEvents, webVitals } from "@/db/schema";
import {
  GOOGLE_PROVIDER,
  googleProfileFromIdToken,
  type GoogleProfile,
} from "@/lib/google-oauth.server";
import { insertAnalyticsEvents } from "@/lib/analytics/serverInsert";
import {
  createSession,
  findSessionByRawToken,
  revokeSessionByRawToken,
} from "@/lib/session-store";

const COOKIE = "chessschool_session";
const SESSION_DAYS = 30;

function dbConn() {
  return db as import("drizzle-orm/libsql").LibSQLDatabase<
    typeof import("@/db/schema")
  >;
}

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  role: string;
};

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

function makeStudentNo(): string {
  const year = new Date().getFullYear();
  const n = Math.floor(10000 + Math.random() * 89999);
  return `CS-${year}-${n}`;
}

async function startSession(userId: string): Promise<void> {
  const token = await createSession(userId, dbConn());
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

/** Set the httpOnly web session cookie (password or Google web login). */
export async function establishWebSession(userId: string): Promise<void> {
  await startSession(userId);
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!name.trim()) return { error: "Enter your name." };
  const existing = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (existing) {
    return { error: "Could not create an account with this email. Try signing in." };
  }

  const id = randomUUID();
  const now = Date.now();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    name: name.trim(),
    role: "student",
    createdAt: now,
  });
  await db.insert(profiles).values({
    userId: id,
    studentNo: makeStudentNo(),
    enrolledAt: now,
    rankTitle: "Novice",
  });
  await db.insert(progress).values({ userId: id, updatedAt: now });
  await startSession(id);
  void insertAnalyticsEvents([{ name: "signup", userId: id }]).catch(() => void 0);
  return { ok: true };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: true } | { error: string }> {
  email = email.trim().toLowerCase();
  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user && !user.passwordHash) {
      return { error: "This account uses Google sign-in." };
    }
    return { error: "Wrong email or password." };
  }
  await startSession(user.id);
  void insertAnalyticsEvents([{ name: "login", userId: user.id }]).catch(() => void 0);
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await revokeSessionByRawToken(token, dbConn());
  jar.delete(COOKIE);
}

async function userFromSession(
  session: { userId: string; expiresAt: number } | null,
): Promise<SessionUser | null> {
  if (!session || session.expiresAt < Date.now()) return null;
  const user = (
    await db.select().from(users).where(eq(users.id, session.userId)).limit(1)
  )[0];
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  return userFromSession(await findSessionByRawToken(token, dbConn()));
}

// ── Token-based auth (for the mobile client; same session token, no cookie) ──

/** Create a session and return its bearer token (no cookie). */
export async function createSessionToken(userId: string): Promise<string> {
  return createSession(userId, dbConn());
}

/** Resolve a user from a bearer token. */
export async function getUserByToken(
  token: string | null | undefined,
): Promise<SessionUser | null> {
  return userFromSession(await findSessionByRawToken(token, dbConn()));
}

/** Resolve the request's user from a Bearer token (mobile) or the cookie (web). */
export async function getApiUser(req: Request): Promise<SessionUser | null> {
  const h = req.headers.get("authorization");
  if (h?.startsWith("Bearer ")) {
    const u = await getUserByToken(h.slice(7));
    if (u) return u;
  }
  return getCurrentUser();
}

export async function revokeToken(token: string): Promise<void> {
  await revokeSessionByRawToken(token, dbConn());
}

export async function registerWithToken(
  email: string,
  password: string,
  name: string,
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (!name.trim()) return { error: "Enter your name." };
  if ((await db.select().from(users).where(eq(users.email, email)).limit(1))[0]) {
    return { error: "Could not create an account with this email. Try signing in." };
  }
  const id = randomUUID();
  const now = Date.now();
  await db.insert(users).values({
    id,
    email,
    passwordHash: await hashPassword(password),
    name: name.trim(),
    role: "student",
    createdAt: now,
  });
  await db.insert(profiles).values({
    userId: id,
    studentNo: makeStudentNo(),
    enrolledAt: now,
    rankTitle: "Novice",
  });
  await db.insert(progress).values({ userId: id, updatedAt: now });
  const token = await createSessionToken(id);
  void insertAnalyticsEvents([{ name: "signup", userId: id }]).catch(() => void 0);
  return { token, user: { id, email, name: name.trim(), role: "student" } };
}

export async function loginWithToken(
  email: string,
  password: string,
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  email = email.trim().toLowerCase();
  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user?.passwordHash || !(await bcrypt.compare(password, user.passwordHash))) {
    if (user && !user.passwordHash) {
      return { error: "This account uses Google sign-in." };
    }
    return { error: "Wrong email or password." };
  }
  const token = await createSessionToken(user.id);
  void insertAnalyticsEvents([{ name: "login", userId: user.id }]).catch(() => void 0);
  return {
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  };
}

async function provisionNewStudent(
  id: string,
  email: string,
  name: string,
  passwordHash: string | null,
): Promise<void> {
  const now = Date.now();
  await db.insert(users).values({
    id,
    email,
    passwordHash,
    name: name.trim(),
    role: "student",
    createdAt: now,
  });
  await db.insert(profiles).values({
    userId: id,
    studentNo: makeStudentNo(),
    enrolledAt: now,
    rankTitle: "Novice",
  });
  await db.insert(progress).values({ userId: id, updatedAt: now });
}

async function linkGoogleAccount(userId: string, sub: string): Promise<void> {
  await db
    .insert(oauthAccounts)
    .values({
      provider: GOOGLE_PROVIDER,
      providerAccountId: sub,
      userId,
      createdAt: Date.now(),
    })
    .onConflictDoNothing();
}

function toSessionUser(user: {
  id: string;
  email: string;
  name: string;
  role: string;
}): SessionUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Sign in or enroll via Google — links to an existing email account when present. */
export async function signInWithGoogle(
  profile: GoogleProfile,
): Promise<{ user: SessionUser; isNewUser: boolean } | { error: string }> {
  if (!profile.emailVerified) {
    return { error: "Google did not verify this email." };
  }

  const email = profile.email.trim().toLowerCase();
  const oauthRow = (
    await db
      .select({ userId: oauthAccounts.userId })
      .from(oauthAccounts)
      .where(
        and(
          eq(oauthAccounts.provider, GOOGLE_PROVIDER),
          eq(oauthAccounts.providerAccountId, profile.sub),
        ),
      )
      .limit(1)
  )[0];

  if (oauthRow) {
    const user = (
      await db.select().from(users).where(eq(users.id, oauthRow.userId)).limit(1)
    )[0];
    if (!user) return { error: "Account not found." };
    void insertAnalyticsEvents([{ name: "login", userId: user.id }]).catch(() => void 0);
    return { user: toSessionUser(user), isNewUser: false };
  }

  const existing = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (existing) {
    await linkGoogleAccount(existing.id, profile.sub);
    void insertAnalyticsEvents([{ name: "login", userId: existing.id }]).catch(
      () => void 0,
    );
    return { user: toSessionUser(existing), isNewUser: false };
  }

  const id = randomUUID();
  await provisionNewStudent(id, email, profile.name, null);
  await linkGoogleAccount(id, profile.sub);
  void insertAnalyticsEvents([{ name: "signup", userId: id }]).catch(() => void 0);
  return {
    user: { id, email, name: profile.name.trim(), role: "student" },
    isNewUser: true,
  };
}

/** Mobile: verify a Google ID token and return a bearer session. */
export async function signInWithGoogleIdToken(
  idToken: string,
): Promise<
  { token: string; user: SessionUser; isNewUser: boolean } | { error: string }
> {
  const profile = await googleProfileFromIdToken(idToken);
  if ("error" in profile) return profile;
  const res = await signInWithGoogle(profile);
  if ("error" in res) return res;
  const token = await createSessionToken(res.user.id);
  return { token, user: res.user, isNewUser: res.isNewUser };
}

/** Permanently delete a student account and all associated data. */
export async function deleteUserAccount(
  userId: string,
): Promise<{ ok: true } | { error: string }> {
  const user = (await db.select().from(users).where(eq(users.id, userId)).limit(1))[0];
  if (!user) return { error: "Account not found." };
  if (user.role === "admin") return { error: "Admin accounts cannot be deleted here." };
  await db.delete(lessonRecords).where(eq(lessonRecords.userId, userId));
  await db.delete(analyticsEvents).where(eq(analyticsEvents.userId, userId));
  await db.delete(webVitals).where(eq(webVitals.userId, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  await db.delete(progress).where(eq(progress.userId, userId));
  await db.delete(profiles).where(eq(profiles.userId, userId));
  await db.delete(oauthAccounts).where(eq(oauthAccounts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
  return { ok: true };
}
