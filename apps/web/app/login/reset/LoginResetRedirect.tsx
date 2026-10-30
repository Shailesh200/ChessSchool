"use client";

import { useEffect } from "react";
import { PASSWORD_RESET_PAGE_PATH } from "@/lib/auth/passwordReset.client";

/** Legacy `/login/reset` → canonical `/account/reset` (preserves hash token from email). */
export function LoginResetRedirect() {
  useEffect(() => {
    const dest = `${PASSWORD_RESET_PAGE_PATH}${window.location.search}${window.location.hash}`;
    window.location.replace(dest);
  }, []);
  return <p className="text-ink-500 p-6 text-center text-sm font-semibold">Redirecting…</p>;
}
