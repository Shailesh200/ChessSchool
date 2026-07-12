import "server-only";
import { OAuth2Client } from "google-auth-library";

const GOOGLE_PROVIDER = "google";

export function googleOAuthConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function googleClientId(): string | null {
  return process.env.GOOGLE_CLIENT_ID ?? process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? null;
}

/** Public site origin for OAuth redirect URIs. */
export function appOrigin(req?: Request): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (req) return new URL(req.url).origin;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

function oauthClient(redirectUri: string): OAuth2Client {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth is not configured.");
  }
  return new OAuth2Client({ clientId, clientSecret, redirectUri });
}

export function googleRedirectUri(req: Request): string {
  return `${appOrigin(req)}/api/auth/google/callback`;
}

export function googleAuthUrl(req: Request, state: string): string {
  const redirectUri = googleRedirectUri(req);
  const client = oauthClient(redirectUri);
  return client.generateAuthUrl({
    access_type: "online",
    scope: ["openid", "email", "profile"],
    include_granted_scopes: true,
    prompt: "select_account",
    state,
  });
}

export type GoogleProfile = {
  sub: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

export async function googleProfileFromCode(
  req: Request,
  code: string,
): Promise<GoogleProfile | { error: string }> {
  const redirectUri = googleRedirectUri(req);
  const client = oauthClient(redirectUri);
  try {
    const { tokens } = await client.getToken(code);
    if (!tokens.id_token) return { error: "Google did not return an ID token." };
    return googleProfileFromIdToken(tokens.id_token);
  } catch {
    return { error: "Could not complete Google sign-in." };
  }
}

export async function googleProfileFromIdToken(
  idToken: string,
): Promise<GoogleProfile | { error: string }> {
  const clientId = googleClientId();
  if (!clientId) return { error: "Google OAuth is not configured." };
  const client = new OAuth2Client(clientId);
  try {
    const ticket = await client.verifyIdToken({ idToken, audience: clientId });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      return { error: "Google profile was incomplete." };
    }
    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name?.trim() || payload.email.split("@")[0] || "Student",
      emailVerified: payload.email_verified === true,
    };
  } catch {
    return { error: "Invalid Google sign-in token." };
  }
}

export { GOOGLE_PROVIDER };
