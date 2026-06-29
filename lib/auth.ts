import "server-only";
import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, sessions, profiles, progress } from "@/db/schema";

const COOKIE = "chessschool_session";
const SESSION_DAYS = 30;

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
  const token = randomUUID();
  const expiresAt = Date.now() + SESSION_DAYS * 86400_000;
  await db.insert(sessions).values({ id: token, userId, expiresAt });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ ok: true } | { error: string }> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!name.trim()) return { error: "Enter your name." };
  const existing = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (existing) return { error: "That email is already enrolled." };

  const id = randomUUID();
  const now = Date.now();
  await db
    .insert(users)
    .values({ id, email, passwordHash: await hashPassword(password), name: name.trim(), role: "student", createdAt: now });
  await db
    .insert(profiles)
    .values({ userId: id, studentNo: makeStudentNo(), enrolledAt: now, rankTitle: "Novice" });
  await db.insert(progress).values({ userId: id, updatedAt: now });
  await startSession(id);
  return { ok: true };
}

export async function loginUser(
  email: string,
  password: string,
): Promise<{ ok: true } | { error: string }> {
  email = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  await startSession(user.id);
  return { ok: true };
}

export async function logout(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.delete(sessions).where(eq(sessions.id, token));
  jar.delete(COOKIE);
}

export async function getCurrentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = (await db.select().from(sessions).where(eq(sessions.id, token)).limit(1))[0];
  if (!session || session.expiresAt < Date.now()) return null;
  const user = (await db.select().from(users).where(eq(users.id, session.userId)).limit(1))[0];
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

// ── Token-based auth (for the mobile client; same session token, no cookie) ──

/** Create a session and return its bearer token (no cookie). */
export async function createSessionToken(userId: string): Promise<string> {
  const token = randomUUID();
  await db.insert(sessions).values({ id: token, userId, expiresAt: Date.now() + SESSION_DAYS * 86400_000 });
  return token;
}

/** Resolve a user from a bearer token. */
export async function getUserByToken(token: string | null | undefined): Promise<SessionUser | null> {
  if (!token) return null;
  const session = (await db.select().from(sessions).where(eq(sessions.id, token)).limit(1))[0];
  if (!session || session.expiresAt < Date.now()) return null;
  const user = (await db.select().from(users).where(eq(users.id, session.userId)).limit(1))[0];
  return user ? { id: user.id, email: user.email, name: user.name, role: user.role } : null;
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
  await db.delete(sessions).where(eq(sessions.id, token));
}

export async function registerWithToken(
  email: string,
  password: string,
  name: string,
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  email = email.trim().toLowerCase();
  if (!email.includes("@")) return { error: "Enter a valid email." };
  if (password.length < 6) return { error: "Password must be at least 6 characters." };
  if (!name.trim()) return { error: "Enter your name." };
  if ((await db.select().from(users).where(eq(users.email, email)).limit(1))[0]) {
    return { error: "That email is already enrolled." };
  }
  const id = randomUUID();
  const now = Date.now();
  await db
    .insert(users)
    .values({ id, email, passwordHash: await hashPassword(password), name: name.trim(), role: "student", createdAt: now });
  await db.insert(profiles).values({ userId: id, studentNo: makeStudentNo(), enrolledAt: now, rankTitle: "Novice" });
  await db.insert(progress).values({ userId: id, updatedAt: now });
  const token = await createSessionToken(id);
  return { token, user: { id, email, name: name.trim(), role: "student" } };
}

export async function loginWithToken(
  email: string,
  password: string,
): Promise<{ token: string; user: SessionUser } | { error: string }> {
  email = email.trim().toLowerCase();
  const user = (await db.select().from(users).where(eq(users.email, email)).limit(1))[0];
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Wrong email or password." };
  }
  const token = await createSessionToken(user.id);
  return { token, user: { id: user.id, email: user.email, name: user.name, role: user.role } };
}
