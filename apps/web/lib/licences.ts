/**
 * Stockfish 18 attribution for the web app. The files in public/engine are
 * byte-identical to stockfish.js 18.0.0 (lite, single-threaded), built from
 * official Stockfish tag sf_18.
 *
 * Keep the revision rules aligned with apps/mobile/src/licences.ts.
 */

export const APP_REPOSITORY_URL = "https://github.com/Shailesh200/ChessSchool";

export const STOCKFISH_COMMIT = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
export const STOCKFISH_TAG = "sf_18";
export const STOCKFISH_SOURCE_URL = `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_COMMIT}`;
export const STOCKFISH_JS_RELEASE_URL =
  "https://github.com/nmrugg/stockfish.js/releases/tag/v18.0.0";

export const STOCKFISH_NOTICE = "Uses Stockfish, licensed under GPL-3.0";

export const STOCKFISH_AUTHORS_CREDIT =
  "Stockfish is free software by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott, and the other authors listed in the Stockfish AUTHORS file.";

const SOURCE_REF = /^[A-Za-z0-9._-]{1,80}$/;

/** Commit, tag, or other single path segment safe to put under `/tree/`. */
export function sourceRevision(revision: string | null | undefined): string | null {
  const rev = revision?.trim() ?? "";
  if (!SOURCE_REF.test(rev) || rev === "." || rev === ".." || rev.includes(".."))
    return null;
  return rev;
}

/** Public source for this build, or the repository root when the ref is unknown. */
export function appSourceUrl(revision: string | null | undefined): string {
  const rev = sourceRevision(revision);
  return rev ? `${APP_REPOSITORY_URL}/tree/${rev}` : APP_REPOSITORY_URL;
}

/** Vercel injects the commit at build time. GitHub Actions sets GITHUB_SHA. */
export function webBuildRevision(
  env: { vercelSha?: string | undefined; githubSha?: string | undefined } = {
    vercelSha: process.env.VERCEL_GIT_COMMIT_SHA,
    githubSha: process.env.GITHUB_SHA,
  },
): string | null {
  return sourceRevision(env.vercelSha) ?? sourceRevision(env.githubSha);
}
