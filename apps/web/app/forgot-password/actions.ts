"use server";

import { headers } from "next/headers";
import { enforceRateLimitHeaders } from "@/lib/rate-limit";
import { PASSWORD_RESET_GENERIC_MESSAGE } from "@/lib/password-reset-messages";
import { requestPasswordReset } from "@/lib/password-reset";
import { appOrigin } from "@/lib/google-oauth.server";

export type ForgotPasswordState =
  | { ok?: false; error?: string }
  | { ok: true; message: string };

export async function requestForgotPasswordAction(
  _prev: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  const limited = await enforceRateLimitHeaders(await headers(), "auth:forgot-password", {
    limit: 5,
    windowMs: 60_000,
  });
  if (limited) {
    return { error: "Too many attempts. Try again in a minute." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!email.includes("@")) {
    return { error: "Enter a valid email address." };
  }

  const h = await headers();
  const origin = appOrigin(
    new Request("http://local", {
      headers: { host: h.get("host") ?? "localhost:3000" },
    }),
  );
  await requestPasswordReset(email, origin);
  return { ok: true, message: PASSWORD_RESET_GENERIC_MESSAGE };
}
