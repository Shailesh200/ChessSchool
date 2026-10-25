/**
 * Runtime fingerprint overrides for `runtimeVersion.policy = "fingerprint"`.
 *
 * `expo/fingerprint` re-exports `@expo/fingerprint`. The package is transitive
 * under pnpm, so the app cannot require `@expo/fingerprint` directly.
 *
 * @type {import("expo/fingerprint").Config}
 */
const { SourceSkips } = require("expo/fingerprint");

const config = {
  // Library default keeps prebuild's android/ios script rewrite out of the hash.
  // ExpoConfigExtraSection drops `extra`. app.config.ts (PR #22) copies
  // EAS_BUILD_GIT_COMMIT_HASH into extra.gitCommit; hashing that would mint a
  // new runtime on every commit, so OTA updates would never match installed builds.
  sourceSkips:
    SourceSkips.PackageJsonAndroidAndIosScriptsIfNotContainRun |
    SourceSkips.ExpoConfigExtraSection,
  ignorePaths: [
    // Fetched Stockfish sources and NNUE nets. Gitignored, and present only after
    // scripts/fetch-stockfish.sh runs, so an iOS EAS build would otherwise hash a
    // different tree than `eas update` where ios/engine/ is absent.
    // Safe because:
    // - the checksum pins live once, at the top of scripts/fetch-stockfish.sh,
    //   and that file is an extraSources file input below
    // - StockfishModule.swift, stockfish-shim.cpp, stockfish-bridge.h,
    //   stockfish-config.h, and Stockfish.podspec are not matched
    // The rest of modules/stockfish is not ignored.
    "modules/stockfish/ios/engine/**/*",
  ],
  extraSources: [
    {
      type: "file",
      filePath: "scripts/fetch-stockfish.sh",
      reasons: ["stockfishFetchPins"],
    },
  ],
};

module.exports = config;
