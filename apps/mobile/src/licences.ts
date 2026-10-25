/**
 * About & licences copy. Stockfish 18 here is tag sf_18
 * (cb3d4ee9b47d0c5aae855b12379378ea1439675c), the same commit as the
 * stockfish.js 18.0.0 lite WASM served from apps/web/public/engine.
 *
 * The build revision is read from Expo config `extra.gitCommit` or
 * `extra.gitTag`, then `EXPO_PUBLIC_GIT_COMMIT`. When none of those is a
 * safe git ref, the source link is the repository root.
 */

export const APP_REPOSITORY_URL = "https://github.com/Shailesh200/ChessSchool";

export const STOCKFISH_COMMIT = "cb3d4ee9b47d0c5aae855b12379378ea1439675c";
export const STOCKFISH_TAG = "sf_18";
export const STOCKFISH_SOURCE_URL = `https://github.com/official-stockfish/Stockfish/tree/${STOCKFISH_COMMIT}`;

export const STOCKFISH_NOTICE = "Uses Stockfish, licensed under GPL-3.0";

export const STOCKFISH_AUTHORS_CREDIT =
  "Stockfish is free software by Tord Romstad, Marco Costalba, Joona Kiiski, Gary Linscott, and the other authors listed in the Stockfish AUTHORS file.";

const SOURCE_REF = /^[A-Za-z0-9._-]{1,80}$/;

export function sourceRevision(revision: string | null | undefined): string | null {
  const rev = revision?.trim() ?? "";
  if (!SOURCE_REF.test(rev) || rev === "." || rev === ".." || rev.includes("..")) return null;
  return rev;
}

export function appSourceUrl(revision: string | null | undefined): string {
  const rev = sourceRevision(revision);
  return rev ? `${APP_REPOSITORY_URL}/tree/${rev}` : APP_REPOSITORY_URL;
}

export type LicenceRevisionInput = {
  gitCommit?: unknown;
  gitTag?: unknown;
  envCommit?: unknown;
  version?: unknown;
};

function asRevision(value: unknown): string | null {
  return typeof value === "string" ? sourceRevision(value) : null;
}

/** Strings rendered by the About & licences screen. */
export function licenceScreenModel(input: LicenceRevisionInput = {}) {
  const revision =
    asRevision(input.gitCommit) ?? asRevision(input.gitTag) ?? asRevision(input.envCommit);
  const version =
    typeof input.version === "string" && input.version.trim() ? input.version.trim() : null;
  return {
    title: "About & licences" as const,
    notice: STOCKFISH_NOTICE,
    credit: STOCKFISH_AUTHORS_CREDIT,
    stockfishSourceUrl: STOCKFISH_SOURCE_URL,
    stockfishSourceHint: `Stockfish ${STOCKFISH_TAG} · ${STOCKFISH_COMMIT.slice(0, 12)}`,
    appSourceUrl: appSourceUrl(revision),
    appSourceKnown: revision != null,
    versionLabel: version ? `ChessSchool v${version}` : "ChessSchool",
  };
}
