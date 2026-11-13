import { createHash, randomBytes, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";

export const SESSION_COOKIE = "cs_session";
export const SESSION_DAYS = 30;

export const newId = () => randomUUID();
export const newToken = () => randomBytes(32).toString("base64url");
export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

export const hashPassword = (pw: string) => bcrypt.hash(pw, 11);
export const checkPassword = (pw: string, hash: string) => bcrypt.compare(pw, hash);

/** Fixed-window limiter per key. In-memory: one instance per process. */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, { count: number; reset: number }>();
  return (key: string): boolean => {
    const t = now();
    const h = hits.get(key);
    if (!h || h.reset <= t) {
      hits.set(key, { count: 1, reset: t + windowMs });
      return true;
    }
    h.count += 1;
    return h.count <= limit;
  };
}
