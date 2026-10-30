"use client";

import { useEffect } from "react";
import { ACCOUNT_RESET_PATH } from "@/features/premium-ui/auth/resetApi";

/** Legacy `/login/reset` → canonical `/account/reset?token=` (preserves query + hash). */
export function LoginResetRedirect() {
  useEffect(() => {
    const dest = `${ACCOUNT_RESET_PATH}${window.location.search}${window.location.hash}`;
    window.location.replace(dest);
  }, []);
  return <p className="text-ink-500 p-6 text-center text-sm font-semibold">Redirecting…</p>;
}
