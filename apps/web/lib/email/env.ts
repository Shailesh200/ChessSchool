import type { EmailEnv } from "./types";

export function envValue(value: string | undefined): string {
  return value?.replace(/[\r\n]/g, "").trim() ?? "";
}

/**
 * Production is `NODE_ENV=production` or `VERCEL_ENV=production`.
 * Vercel sets `CI=1` on production deployments, so CI must not override this.
 */
export function isProduction(env: EmailEnv = process.env): boolean {
  return (
    envValue(env.VERCEL_ENV) === "production" || envValue(env.NODE_ENV) === "production"
  );
}
