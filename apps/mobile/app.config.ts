import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Spreads app.json and records the EAS build commit on extra.gitCommit.
 * EAS_BUILD_GIT_COMMIT_HASH exists only while EAS is building. When it is
 * absent, the About screen links to the repository root.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  const gitCommit = process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim();
  return {
    ...config,
    name: config.name ?? "ChessSchool",
    slug: config.slug ?? "chess-school",
    extra: {
      ...config.extra,
      ...(gitCommit ? { gitCommit } : {}),
    },
  };
};
