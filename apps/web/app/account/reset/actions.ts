"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { enforceRateLimitHeaders } from "@/lib/rate-limit";
import { resetPasswordWithToken } from "@/lib/password-reset";

export type ResetPasswordState = { error: string };

export async function resetPasswordAction(
  _prev: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState | undefined> {
  const limited = await enforceRateLimitHeaders(await headers(), "auth:reset-password", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) {
    return { error: "Too many attempts. Try again in a minute." };
  }

  const token = String(formData.get("token") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!token) return { error: "This reset link is invalid or has expired." };

  const res = await resetPasswordWithToken(token, password);
  if ("error" in res) return { error: res.error };
  redirect("/login");
}
