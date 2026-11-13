import { createHash, createPublicKey, verify, type JsonWebKey } from "node:crypto";
import { audienceAllowed } from "./google";

export type AppleIdentity = { sub: string; email: string; emailVerified: boolean };
export type AppleVerifier = (identityToken: string, nonce?: string) => Promise<AppleIdentity | null>;

export type AppleJwk = JsonWebKey & { kid?: string };

const APPLE_ISS = "https://appleid.apple.com";
const APPLE_KEYS = "https://appleid.apple.com/auth/keys";
const CLOCK_SKEW_SEC = 60;
const KEY_TTL_MS = 60 * 60 * 1000;

/** Comma-separated Apple audiences (bundle id, Services ID). Trims and drops empties. */
export function parseAppleClientIds(raw: string | undefined | null): string[] {
  if (typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

type AppleClaims = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  iat?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  nonce?: string;
};

async function fetchAppleJwks(): Promise<{ keys: AppleJwk[] }> {
  const res = await fetch(APPLE_KEYS);
  if (!res.ok) throw new Error("apple jwks unavailable");
  return (await res.json()) as { keys: AppleJwk[] };
}

function readJson(part: string): unknown {
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

/**
 * Verifies a Sign in with Apple identity token.
 * Returns null when APPLE_CLIENT_IDS is missing or empty so the route can answer 503.
 * Never accepts a token without an audience check.
 */
export function createAppleVerifier(
  clientIds: readonly string[],
  deps?: { fetchJwks?: () => Promise<{ keys: AppleJwk[] }>; now?: () => number; ttlMs?: number },
): AppleVerifier | null {
  const ids = clientIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (ids.length === 0) return null;
  const fetchJwks = deps?.fetchJwks ?? fetchAppleJwks;
  const now = deps?.now ?? Date.now;
  const ttlMs = deps?.ttlMs ?? KEY_TTL_MS;
  let cache: { keys: AppleJwk[]; at: number } | null = null;

  async function keys(force: boolean): Promise<AppleJwk[]> {
    if (!force && cache && now() - cache.at < ttlMs) return cache.keys;
    const body = await fetchJwks();
    const list = Array.isArray(body?.keys) ? body.keys.filter((key) => key && typeof key === "object") : [];
    cache = { keys: list, at: now() };
    return list;
  }

  return async (identityToken, nonce) => {
    try {
      const parts = identityToken.split(".");
      if (parts.length !== 3 || parts.some((part) => !part)) return null;
      const header = readJson(parts[0]!) as { alg?: string; kid?: string };
      if (header.alg !== "RS256" || typeof header.kid !== "string" || !header.kid) return null;
      let set = await keys(false);
      let jwk = set.find((key) => key.kid === header.kid);
      if (!jwk) {
        set = await keys(true);
        jwk = set.find((key) => key.kid === header.kid);
      }
      if (!jwk?.kty || !jwk.n || !jwk.e) return null;
      const key = createPublicKey({ key: jwk, format: "jwk" });
      const signed = Buffer.from(`${parts[0]}.${parts[1]}`);
      const signature = Buffer.from(parts[2]!, "base64url");
      if (!verify("RSA-SHA256", signed, key, signature)) return null;
      const payload = readJson(parts[1]!) as AppleClaims;
      if (payload.iss !== APPLE_ISS) return null;
      if (!audienceAllowed(payload.aud, ids)) return null;
      const seconds = Math.floor(now() / 1000);
      if (typeof payload.exp !== "number" || payload.exp < seconds - CLOCK_SKEW_SEC) return null;
      if (typeof payload.iat !== "number" || payload.iat > seconds + CLOCK_SKEW_SEC) return null;
      if (typeof payload.sub !== "string" || !payload.sub) return null;
      if (typeof nonce === "string" && nonce.length > 0) {
        const expected = createHash("sha256").update(nonce).digest("hex");
        if (typeof payload.nonce !== "string" || payload.nonce.toLowerCase() !== expected) return null;
      }
      const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
      const emailVerified = payload.email_verified === true || payload.email_verified === "true";
      return { sub: payload.sub, email, emailVerified };
    } catch {
      return null;
    }
  };
}

export function appleVerifierFromEnv(env: { APPLE_CLIENT_IDS?: string }): AppleVerifier | null {
  return createAppleVerifier(parseAppleClientIds(env.APPLE_CLIENT_IDS));
}
