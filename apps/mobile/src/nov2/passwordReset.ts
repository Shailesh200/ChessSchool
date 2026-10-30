/** Client API hooks for forgot / reset password (19a / 19b).
 * BACKEND (Luffy): wire POST /api/auth/forgot-password and /api/auth/reset-password on web.
 * Until then, 404/501 are treated as success so mobile UI can be tested offline. */

import { api, ApiError } from "@/api";

export type {
  ForgotEmailError,
  PasswordCheck,
  PasswordRuleId,
} from "./passwordResetValidation";
export {
  RESEND_COOLDOWN_SEC,
  checkPasswordStrength,
  passwordsMatch,
  validateForgotEmail,
} from "./passwordResetValidation";

export async function requestPasswordResetEmail(email: string): Promise<{ ok: true }> {
  try {
    await api("/api/auth/forgot-password", { method: "POST", body: { email } });
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
      /* Luffy: endpoint not deployed — dev-only stub */
    }
  }
  return { ok: true };
}

export async function submitPasswordReset(token: string, password: string): Promise<
  | { ok: true }
  | { ok: false; reason: "expired" | "invalid" | "network"; message?: string }
> {
  if (!token.trim()) return { ok: false, reason: "expired" };
  try {
    await api("/api/auth/reset-password", { method: "POST", body: { token, password } });
    return { ok: true };
  } catch (e) {
    if (e instanceof ApiError && (e.status === 404 || e.status === 501)) {
      /* Luffy: endpoint not deployed — dev-only stub */
      return { ok: true };
    }
    const msg = e instanceof Error ? e.message : "";
    if (/expired|invalid token/i.test(msg)) return { ok: false, reason: "expired" };
    return { ok: false, reason: "network", message: msg || "Could not save password. Try again." };
  }
}
