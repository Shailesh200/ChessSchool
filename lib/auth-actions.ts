"use server";

import { redirect } from "next/navigation";
import { registerUser, loginUser, logout } from "@/lib/auth";

export async function registerAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const res = await registerUser(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
    String(formData.get("name") ?? ""),
  );
  if ("error" in res) return { error: res.error };
  redirect("/onboarding");
}

export async function loginAction(
  _prev: { error?: string } | undefined,
  formData: FormData,
): Promise<{ error?: string }> {
  const res = await loginUser(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if ("error" in res) return { error: res.error };
  redirect("/welcome"); // pull account progress behind a loader, then → Learn tab
}

export async function logoutAction(): Promise<void> {
  await logout();
  redirect("/login");
}
