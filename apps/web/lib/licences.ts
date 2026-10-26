/**
 * The files in public/engine are the stockfish.js v18.0.0 lite WASM build
 * (commit 31a98753a5d932511693f44775da908377c24513), not an official
 * Stockfish binary. Official Stockfish sf_18 is the upstream origin.
 *
 * Keep the commit-SHA rules aligned with apps/mobile/src/licences.ts.
 */

export const APP_REPOSITORY_URL = "https://github.com/Shailesh200/ChessSchool";

/** stockfish.js v18.0.0 — the build whose WASM we ship. */
export const STOCKFISH_JS_COMMIT = "31a98753a5d932511693f44775da908377c24513";
export const STOCKFISH_JS_TAG = "v18.0.0";
export const STOCKFISH_JS_SOURCE_URL = `https://github.com/nmrugg/stockfish.js/tree/${STOCKFISH_JS_COMMIT}`;

/** Official Stockfish 18, the origin of the stockfish.js port. */
export const STOCKFISH_UPSTREAM_COMMIT = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
export const STOCKFISH_UPSTREAM_TAG = "sf_18";
export const STOCKFISH_UPSTREAM_URL = `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_UPSTREAM_COMMIT}`;

export const STOCKFISH_NOTICE = "Uses Stockfish, licensed under GPL-3.0";

export const STOCKFISH_AUTHORS_CREDIT =
  "Stockfish is free software by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott, and the other authors listed in the Stockfish AUTHORS file.";

const COMMIT_SHA = /^[0-9a-f]{40}$/i;

/** Full git commit, or null when the value is missing or not a SHA. */
export function commitSha(revision: string | null | undefined): string | null {
  const rev = revision?.trim() ?? "";
  return COMMIT_SHA.test(rev) ? rev.toLowerCase() : null;
}

/** Public source for this build, or the repository root when the SHA is unknown. */
export function appSourceUrl(revision: string | null | undefined): string {
  const sha = commitSha(revision);
  return sha ? `${APP_REPOSITORY_URL}/tree/${sha}` : APP_REPOSITORY_URL;
}

/** Vercel sets VERCEL_GIT_COMMIT_SHA for the deployment commit. */
export function webBuildRevision(
  env: { vercelSha?: string | undefined } = {
    vercelSha: process.env.VERCEL_GIT_COMMIT_SHA,
  },
): string | null {
  return commitSha(env.vercelSha);
}
