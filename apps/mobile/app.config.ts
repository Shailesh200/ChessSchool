import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * The login screen auto-submits a deep-link password when this flag is "1".
 * Any value is refused: a store build must not have the variable at all.
 */
function assertStoreProfileOmitsParityFlag(): void {
  const profile = process.env.EAS_BUILD_PROFILE?.trim();
  if (profile !== "production" && profile !== "preview") return;
  if (process.env.EXPO_PUBLIC_PARITY === undefined) return;
  throw new Error(
    `Refusing Expo config for EAS profile "${profile}": EXPO_PUBLIC_PARITY is set to ${JSON.stringify(process.env.EXPO_PUBLIC_PARITY)}. Production and preview builds must not include the parity auto-login deep link.`,
  );
}

/**
 * Spreads app.json and records the EAS build commit on extra.gitCommit.
 * EAS_BUILD_GIT_COMMIT_HASH exists only while EAS is building. When it is
 * absent, the About screen links to the repository root.
 */
export default ({ config }: ConfigContext): ExpoConfig => {
  assertStoreProfileOmitsParityFlag();
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
