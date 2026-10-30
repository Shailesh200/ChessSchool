"use server";

import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";

export type ForgotPasswordState =
  | { ok?: false; error?: string }
  | { ok: true; message: string };

/**
 * Placeholder until the reset backend is wired (commit b).
 * Always returns the generic success copy without touching the database.
 */
export async function requestForgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) {
    return { error: "Enter a valid email address." };
  }
  return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
}
