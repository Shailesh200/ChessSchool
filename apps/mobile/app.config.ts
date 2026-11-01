import type { ConfigContext, ExpoConfig } from "expo/config";
import { assertQaSimApiUrl, assertQaSimFlag } from "./src/qaSimApiUrl.ts";

/**
 * Spreads app.json and records the EAS build commit on extra.gitCommit.
 * EAS_BUILD_GIT_COMMIT_HASH exists only while EAS is building. When it is
 * absent, the About screen links to the repository root.
 *
 * A qa-sim build fails here unless EXPO_PUBLIC_API_URL is one of the
 * simulator hosts and EXPO_PUBLIC_QA_SIM is exactly "1".
 * eas-build-on-success greps the bundle afterwards.
 *
 * Only a qa-sim build adds withQaSimNetworkSecurity, which allows plain HTTP
 * to 10.0.2.2 and localhost on Android. Every other profile keeps the plugin
 * list from app.json, so cleartext stays blocked.
 */
const QA_SIM_NETWORK_SECURITY_PLUGIN = "./plugins/withQaSimNetworkSecurity.js";

export default ({ config }: ConfigContext): ExpoConfig => {
  if (process.env.EAS_BUILD_PROFILE === "qa-sim") {
    assertQaSimApiUrl(process.env.EXPO_PUBLIC_API_URL);
    assertQaSimFlag(process.env.EXPO_PUBLIC_QA_SIM);
  }
  const gitCommit = process.env.EAS_BUILD_GIT_COMMIT_HASH?.trim();
  const qaSimPlugins =
    process.env.EAS_BUILD_PROFILE === "qa-sim"
      ? { plugins: [...(config.plugins ?? []), QA_SIM_NETWORK_SECURITY_PLUGIN] }
      : {};
  return {
    ...config,
    ...qaSimPlugins,
    name: config.name ?? "ChessSchool",
    slug: config.slug ?? "chess-school",
    extra: {
      ...config.extra,
      ...(gitCommit ? { gitCommit } : {}),
    },
  };
};
