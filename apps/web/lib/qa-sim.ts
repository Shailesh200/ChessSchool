/**
 * QA simulator server flag.
 *
 * The qa-sim runner serves the API with `next start`, which forces
 * NODE_ENV=production, so NODE_ENV cannot tell the simulator from a real
 * deploy. This check says "qa-sim" only when `QA_SIM=1` is set AND nothing
 * says this is a real deployment:
 *   - no Vercel variable (VERCEL, VERCEL_ENV: production and preview),
 *   - no remote database (DATABASE_URL must be a `file:` URL, the same rule
 *     as scripts/qa-sim-guard.sh), no DATABASE_AUTH_TOKEN, no TURSO_*.
 * Only scripts/qa-sim-web.sh sets QA_SIM; no deploy config does.
 */
export function isQaSimServer(
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (env.QA_SIM !== "1") return false;
  if (env.VERCEL || env.VERCEL_ENV) return false;
  if (env.DATABASE_AUTH_TOKEN) return false;
  if (Object.keys(env).some((k) => k.startsWith("TURSO_"))) return false;
  return (env.DATABASE_URL ?? "").startsWith("file:");
}
