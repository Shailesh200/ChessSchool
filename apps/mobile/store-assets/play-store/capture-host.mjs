/**
 * Hosts where capture.mjs may call /api/auth/register.
 *
 * Allowed: localhost, 127.0.0.1, or a hostname matching
 * ^chess-school-git-[a-z0-9-]+\.vercel\.app$ whose branch part is not
 * main or staging and does not start with main- or staging-.
 * That refuses chess-school.vercel.app, -git-main and -git-staging builds,
 * other projects' *.vercel.app hosts, and lookalikes.
 */

/** Branch preview only: chess-school-git-<branch>.vercel.app, never main or staging. */
const CAPTURE_PREVIEW_HOST = /^chess-school-git-([a-z0-9-]+)\.vercel\.app$/;

function isAllowedCaptureHost(host) {
  if (host === "localhost" || host === "127.0.0.1") return true;
  const match = CAPTURE_PREVIEW_HOST.exec(host);
  if (!match) return false;
  const branch = match[1];
  if (branch === "main" || branch === "staging") return false;
  if (branch.startsWith("main-") || branch.startsWith("staging-")) return false;
  return true;
}

/** Throw before registration when BASE_URL is not a local or branch-preview host. */
export function assertSafeCaptureHost(url) {
  let host = "";
  try {
    host = new URL(url).hostname;
  } catch {
    throw new Error(`Refusing to register a capture user: BASE_URL is not a valid URL (${url})`);
  }
  if (!isAllowedCaptureHost(host)) {
    throw new Error(
      `Refusing to register a capture user on ${host || url}. BASE_URL must be localhost, 127.0.0.1, or chess-school-git-<branch>.vercel.app for a branch other than main or staging.`,
    );
  }
}
