import "server-only";
import { appOrigin } from "@/lib/google-oauth.server";

/** True when reset emails must not fall back to request Host / req.url. */
export function passwordResetProductionFailClosed(): boolean {
  return process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
}

/**
 * Origin for password-reset links — only {@link process.env.NEXT_PUBLIC_APP_URL}
 * in production; never derived from the incoming request.
 */
export function passwordResetLinkOrigin(): string | null {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  if (configured) return configured;
  if (passwordResetProductionFailClosed()) return null;
  return appOrigin();
}
