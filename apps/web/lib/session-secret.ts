import { createHmac, timingSafeEqual } from "crypto";

const DEV_FALLBACK = "chessschool-dev-session-secret";

/** HMAC secret for online PvP seat tokens. Requires SESSION_TOKEN_SECRET in production. */
export function getSessionTokenSecret(): string {
  const secret = process.env.SESSION_TOKEN_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production" || process.env.VERCEL) {
    throw new Error("SESSION_TOKEN_SECRET must be set in production");
  }
  return DEV_FALLBACK;
}

export function signSeatToken(id: string, color: "w" | "b", userId: string): string {
  return createHmac("sha256", getSessionTokenSecret())
    .update(`${id}:${color}:${userId}`)
    .digest("base64url");
}

export function formatSeatToken(id: string, color: "w" | "b", userId: string): string {
  return `${color}.${signSeatToken(id, color, userId)}`;
}

export function verifySeatToken(
  id: string,
  color: "w" | "b",
  userId: string,
  token: string | undefined,
): boolean {
  if (!token) return false;
  const [tokenColor, sig] = token.split(".");
  if (tokenColor !== color || !sig) return false;
  const expected = signSeatToken(id, color, userId);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}
