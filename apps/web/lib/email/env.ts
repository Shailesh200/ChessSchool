import type { EmailEnv } from "./types";

export function envValue(value: string | undefined): string {
  return value?.replace(/[\r\n]/g, "").trim() ?? "";
}

/**
 * Real production only. Vercel preview and other non-production deployments
 * set `NODE_ENV=production` but a different `VERCEL_ENV`, and those must keep
 * the console transport. `CI` is ignored: Vercel sets `CI=1` everywhere.
 *
 * Fail closed when:
 * - `VERCEL_ENV=production`, or
 * - `VERCEL_ENV` is unset and `NODE_ENV=production`.
 */
export function isProduction(env: EmailEnv = process.env): boolean {
  const vercelEnv = envValue(env.VERCEL_ENV);
  if (vercelEnv === "production") return true;
  if (vercelEnv !== "") return false;
  return envValue(env.NODE_ENV) === "production";
}
