/** Public reset page path (query carries the raw token). */
export const ACCOUNT_RESET_PATH = "/account/reset";

export function accountResetLink(origin: string, rawToken: string): string {
  const base = origin.replace(/\/+$/, "");
  return `${base}${ACCOUNT_RESET_PATH}?token=${encodeURIComponent(rawToken)}`;
}
