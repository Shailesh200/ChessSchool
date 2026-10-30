/**
 * Client for nov2/luffy-backend password reset (W-004).
 * Email links: `{origin}/account/reset#{token}` (see password-reset.ts on luffy-backend).
 *
 *   POST /api/auth/forgot-password
 *   POST /api/auth/reset-password  { token, password }
 */

export const PASSWORD_RESET_PAGE_PATH = "/account/reset";

const FORGOT_PATH = "/api/auth/forgot-password";
const RESET_PATH = "/api/auth/reset-password";

export type RequestPasswordResetResult =
  | { ok: true }
  | { ok: false; code: "invalid_email"; message: string }
  | { ok: false; code: "rate_limited"; message: string }
  | { ok: false; code: "network"; message: string };

export type ValidateResetTokenResult =
  | { status: "valid" }
  | { status: "expired" }
  | { status: "invalid" }
  | { status: "network" };

export type CompletePasswordResetResult =
  | { ok: true }
  | { ok: false; code: "expired" | "weak_password" | "mismatch" | "network"; message: string };

function parseError(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string") return err;
  }
  return parseMessage(data);
}

function parseMessage(data: unknown): string | undefined {
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

/** Request a reset email. Generic success unless email is invalid or rate limited. */
export async function requestPasswordReset(email: string): Promise<RequestPasswordResetResult> {
  const trimmed = email.trim();
  if (!trimmed.includes("@") || trimmed.endsWith("@") || !trimmed.includes(".")) {
    return {
      ok: false,
      code: "invalid_email",
      message: "That email looks incomplete. Add the part after the @, like name@example.com.",
    };
  }

  try {
    const res = await fetch(FORGOT_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });
    if (res.status === 429) {
      return {
        ok: false,
        code: "rate_limited",
        message: parseMessage(await res.json().catch(() => null)) ?? "Too many requests. Try again later.",
      };
    }
    if (res.status === 404) {
      return { ok: true };
    }
    if (res.ok || res.status === 400) {
      return { ok: true };
    }
    return { ok: false, code: "network", message: "Something went wrong. Try again." };
  } catch {
    return { ok: false, code: "network", message: "Something went wrong. Check your connection." };
  }
}

/** Resend uses the same endpoint as the initial request. */
export const resendPasswordReset = requestPasswordReset;

/**
 * Luffy validates tokens on POST only — treat a non-empty hash token as valid for the form.
 */
export async function validatePasswordResetToken(
  token: string,
): Promise<ValidateResetTokenResult> {
  if (!token.trim()) return { status: "invalid" };
  return { status: "valid" };
}

export async function completePasswordReset(
  token: string,
  password: string,
): Promise<CompletePasswordResetResult> {
  try {
    const res = await fetch(RESET_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    if (res.ok) return { ok: true };
    if (res.status === 404) {
      return { ok: true };
    }
    const body = await res.json().catch(() => null);
    const message = parseError(body) ?? "Could not update your password.";
    if (res.status === 400) {
      if (/expired|invalid/i.test(message)) {
        return { ok: false, code: "expired", message };
      }
      if (/8 characters/i.test(message)) {
        return { ok: false, code: "weak_password", message };
      }
      return { ok: false, code: "network", message };
    }
    return { ok: false, code: "network", message };
  } catch {
    return { ok: false, code: "network", message: "Something went wrong. Check your connection." };
  }
}

/** Reads token from `/account/reset#…` (luffy email) or legacy `?token=`. */
export function readResetTokenFromLocation(search: string, hash: string): string {
  const fromQuery = new URLSearchParams(search).get("token");
  if (fromQuery) return fromQuery;
  const h = hash.startsWith("#") ? hash.slice(1) : hash;
  if (!h) return "";
  if (h.includes("=")) {
    const params = new URLSearchParams(h);
    return params.get("token") ?? params.get("t") ?? h;
  }
  return h;
}
