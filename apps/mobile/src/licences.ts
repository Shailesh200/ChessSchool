/**
 * About & licences copy.
 *
 * Android and web ship stockfish.js v18.0.0 (commit 31a98753). iOS compiles
 * native Stockfish from the official sf_18 tarball (commit cb3d4ee9), so the
 * iOS screen links that source instead of stockfish.js.
 *
 * The app source link uses a full commit SHA. EAS writes
 * EAS_BUILD_GIT_COMMIT_HASH into Expo config extra.gitCommit at build time.
 * Anything else falls back to the repository root.
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

export type LicenceRevisionInput = {
  /** Expo extra.gitCommit, set from EAS_BUILD_GIT_COMMIT_HASH. */
  gitCommit?: unknown;
  version?: unknown;
  /** `Platform.OS`. Only `ios` links the native sf_18 sources. */
  platform?: string;
};

/** Strings rendered by the About & licences screen. */
export function licenceScreenModel(input: LicenceRevisionInput = {}) {
  const revision = typeof input.gitCommit === "string" ? commitSha(input.gitCommit) : null;
  const version =
    typeof input.version === "string" && input.version.trim() ? input.version.trim() : null;
  const nativeIos = input.platform === "ios";
  const upstreamHint = `Official Stockfish ${STOCKFISH_UPSTREAM_TAG} · ${STOCKFISH_UPSTREAM_COMMIT.slice(0, 12)}`;
  return {
    title: "About & licences" as const,
    notice: STOCKFISH_NOTICE,
    credit: STOCKFISH_AUTHORS_CREDIT,
    shippedSourceLabel: nativeIos ? "Stockfish source" : "Shipped engine source",
    shippedSourceUrl: nativeIos ? STOCKFISH_UPSTREAM_URL : STOCKFISH_JS_SOURCE_URL,
    shippedSourceHint: nativeIos
      ? upstreamHint
      : `stockfish.js ${STOCKFISH_JS_TAG} · ${STOCKFISH_JS_COMMIT.slice(0, 12)}`,
    upstreamSourceUrl: nativeIos ? null : STOCKFISH_UPSTREAM_URL,
    upstreamSourceHint: nativeIos ? null : upstreamHint,
    appSourceUrl: appSourceUrl(revision),
    appSourceKnown: revision != null,
    versionLabel: version ? `ChessSchool v${version}` : "ChessSchool",
  };
}
