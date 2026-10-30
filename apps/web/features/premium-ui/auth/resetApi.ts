/**
 * Password reset client (Luffy contract — W-004).
 * TODO: replace with imports from `@/lib/auth/passwordReset.client` + `@/lib/auth/password-reset-path`
 * once nov2/luffy-backend is merged (avoid duplicate paths until then).
 */

export const ACCOUNT_RESET_PATH = "/account/reset";

const FORGOT_PATH = "/api/auth/password/forgot";
const RESET_PATH = "/api/auth/password/reset";

const RATE_LIMIT_MSG = "Too many tries. Wait a bit.";

function parseErrorBody(data: unknown): string | undefined {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error?: unknown }).error;
    if (typeof err === "string") return err;
  }
  if (data && typeof data === "object" && "message" in data) {
    const m = (data as { message?: unknown }).message;
    if (typeof m === "string") return m;
  }
  return undefined;
}

export type PostPasswordForgotResult =
  | { ok: true; message?: string }
  | { ok: false; code: "invalid" | "rate_limited" | "network"; message: string };

/** POST /api/auth/password/forgot — always 200 { ok, message } on success path, or 400 / 429. */
export async function postPasswordForgot(email: string): Promise<PostPasswordForgotResult> {
  const trimmed = email.trim();
  if (!trimmed.includes("@") || trimmed.endsWith("@") || !trimmed.includes(".")) {
    return {
      ok: false,
      code: "invalid",
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
      return { ok: false, code: "rate_limited", message: RATE_LIMIT_MSG };
    }
    const body = await res.json().catch(() => null);
    if (res.status === 400) {
      return {
        ok: false,
        code: "invalid",
        message: parseErrorBody(body) ?? "Check the email and try again.",
      };
    }
    if (res.ok) {
      const message =
        body && typeof body === "object" && "message" in body
          ? String((body as { message?: unknown }).message)
          : undefined;
      return { ok: true, message };
    }
    return { ok: false, code: "network", message: "Something went wrong. Try again." };
  } catch {
    return { ok: false, code: "network", message: "Something went wrong. Check your connection." };
  }
}

export type PostPasswordResetResult =
  | { ok: true }
  | {
      ok: false;
      code: "invalid_link" | "weak_password" | "rate_limited" | "network";
      message: string;
    };

/** POST /api/auth/password/reset — 200 { ok: true } or 400 / 429. No GET token check. */
export async function postPasswordReset(
  token: string,
  password: string,
): Promise<PostPasswordResetResult> {
  if (password.length < 8) {
    return { ok: false, code: "weak_password", message: "Use at least 8 characters." };
  }
  if (!token.trim()) {
    return { ok: false, code: "invalid_link", message: "This reset link is invalid or has expired." };
  }

  try {
    const res = await fetch(RESET_PATH, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim(), password }),
    });
    if (res.status === 429) {
      return { ok: false, code: "rate_limited", message: RATE_LIMIT_MSG };
    }
    const body = await res.json().catch(() => null);
    if (res.status === 400) {
      const message =
        parseErrorBody(body) ?? "This reset link is invalid or has expired.";
      if (/8 character/i.test(message)) {
        return { ok: false, code: "weak_password", message };
      }
      return { ok: false, code: "invalid_link", message };
    }
    if (res.ok) {
      if (body && typeof body === "object" && (body as { ok?: unknown }).ok === true) {
        return { ok: true };
      }
      return { ok: true };
    }
    return { ok: false, code: "network", message: "Something went wrong. Try again." };
  } catch {
    return { ok: false, code: "network", message: "Something went wrong. Check your connection." };
  }
}

/** Email links use `/account/reset?token=` */
export function readResetTokenFromSearch(search: string): string {
  return new URLSearchParams(search).get("token")?.trim() ?? "";
}
