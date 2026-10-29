import type { ConfigContext, ExpoConfig } from "expo/config";
import { assertQaSimApiUrl } from "./src/qaSimApiUrl";

/**
 * Spreads app.json and records the EAS build commit on extra.gitCommit.
 * EAS_BUILD_GIT_COMMIT_HASH exists only while EAS is building. When it is
 * absent, the About screen links to the repository root.
 *
 * A qa-sim build fails here unless EXPO_PUBLIC_API_URL is one of the
 * simulator hosts. eas-build-on-success greps the bundle afterwards.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EAS_BUILD_PROFILE === "qa-sim") {
    assertQaSimApiUrl(process.env.EXPO_PUBLIC_API_URL);
  }
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
