import { OAuth2Client } from "google-auth-library";

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; name: string };
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity | null>;

export type GoogleTokenClaims = {
  sub?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  aud?: string | string[];
};

/** Comma-separated client ids. Trims each entry and drops empties. */
export function parseGoogleClientIds(raw: string | undefined | null): string[] {
  if (typeof raw !== "string") return [];
  return raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0);
}

function audienceValues(aud: string | string[] | undefined): string[] {
  if (typeof aud === "string") return aud.trim() ? [aud.trim()] : [];
  if (!Array.isArray(aud)) return [];
  return aud.filter((value): value is string => typeof value === "string").map((value) => value.trim()).filter((value) => value.length > 0);
}

/**
 * Fail closed. Every audience on the token must equal one allowed id.
 * A missing audience, an empty allow-list, or any extra audience is rejected.
 */
export function audienceAllowed(aud: string | string[] | undefined, clientIds: readonly string[]): boolean {
  const allowed = new Set(clientIds.map((id) => id.trim()).filter((id) => id.length > 0));
  const got = audienceValues(aud);
  if (got.length === 0 || allowed.size === 0) return false;
  return got.every((value) => allowed.has(value));
}

async function verifyWithGoogle(idToken: string, audience: readonly string[]): Promise<GoogleTokenClaims | null> {
  const client = new OAuth2Client();
  const ticket = await client.verifyIdToken({ idToken, audience: [...audience] });
  const payload = ticket.getPayload();
  if (!payload) return null;
  return {
    sub: payload.sub,
    email: payload.email,
    email_verified: payload.email_verified,
    name: payload.name,
    given_name: payload.given_name,
    aud: payload.aud,
  };
}

/**
 * Verifies a Google ID token against the allowed client IDs.
 * Returns null when the allow-list is missing or empty so the route can answer 503.
 * Never verifies without an audience, and never accepts a token whose audience is not on the list.
 */
export function createGoogleVerifier(
  clientIds: readonly string[],
  verify: (idToken: string, audience: readonly string[]) => Promise<GoogleTokenClaims | null> = verifyWithGoogle,
): GoogleVerifier | null {
  const ids = clientIds.map((id) => id.trim()).filter((id) => id.length > 0);
  if (ids.length === 0) return null;
  return async (idToken) => {
    try {
      const claims = await verify(idToken, ids);
      if (!claims?.sub || !claims.email) return null;
      if (!audienceAllowed(claims.aud, ids)) return null;
      return {
        sub: claims.sub,
        email: claims.email.toLowerCase(),
        emailVerified: claims.email_verified === true,
        name: claims.name ?? claims.given_name ?? "",
      };
    } catch {
      return null;
    }
  };
}

/** `GOOGLE_CLIENT_IDS` from the environment. Unset, blank, or commas-only yields no verifier. */
export function googleVerifierFromEnv(env: { GOOGLE_CLIENT_IDS?: string }): GoogleVerifier | null {
  return createGoogleVerifier(parseGoogleClientIds(env.GOOGLE_CLIENT_IDS));
}
