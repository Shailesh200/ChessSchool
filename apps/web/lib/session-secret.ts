import { createHmac } from "crypto";

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

export function signSeatToken(id: string, color: "w" | "b"): string {
  return createHmac("sha256", getSessionTokenSecret()).update(`${id}:${color}`).digest("base64url");
}

export function formatSeatToken(id: string, color: "w" | "b"): string {
  return `${color}.${signSeatToken(id, color)}`;
}
