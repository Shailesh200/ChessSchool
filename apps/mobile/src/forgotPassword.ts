import { API_URL } from "./api";

/**
 * W-004 / DP-M-007: the in-app "Forgot password?" link opens the web
 * /forgot-password page on the SAME base URL the app already uses for its API
 * (EXPO_PUBLIC_API_URL, or the app's own fallback). No host literal lives here,
 * so qa-sim bundles stay free of the production host.
 */
export function forgotPasswordUrl(base: string = API_URL): string {
  return `${base.replace(/\/+$/, "")}/forgot-password`;
}

export const FORGOT_PASSWORD_URL = forgotPasswordUrl();
