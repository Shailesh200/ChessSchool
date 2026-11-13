import { OAuth2Client } from "google-auth-library";

export type GoogleIdentity = { sub: string; email: string; emailVerified: boolean; name: string };
export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity | null>;

/** Verifies a Google ID token against the allowed client IDs (web + native). */
export function createGoogleVerifier(clientIds: string[]): GoogleVerifier | null {
  if (clientIds.length === 0) return null;
  const client = new OAuth2Client();
  return async (idToken) => {
    try {
      const ticket = await client.verifyIdToken({ idToken, audience: clientIds });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email) return null;
      return { sub: p.sub, email: p.email.toLowerCase(), emailVerified: p.email_verified === true, name: p.name ?? p.given_name ?? "" };
    } catch {
      return null;
    }
  };
}
