"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { registerUser, loginUser, logout } from "@/lib/auth";
import { authCredentialsSchema, authRegisterSchema } from "@/lib/api-schemas";
import { enforceRateLimitHeaders } from "@/lib/rate-limit";

export async function registerAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const limited = enforceRateLimitHeaders(await headers(), "auth:register", {
    limit: 10,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = authRegisterSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? ""),
  });
  if (!parsed.success) return { error: "Check your email, name, and password." };

  const { email, password, name } = parsed.data;
  const res = await registerUser(email, password, name);
  if ("error" in res) return { error: res.error };
  redirect("/onboarding");
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const limited = enforceRateLimitHeaders(await headers(), "auth:login", {
    limit: 15,
    windowMs: 60_000,
  });
  if (limited) return limited;

  const parsed = authCredentialsSchema.safeParse({
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  });
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const { email, password } = parsed.data;
  const res = await loginUser(email, password);
  if ("error" in res) return { error: res.error };
  redirect("/welcome"); // pull account progress behind a loader, then → Learn tab
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
