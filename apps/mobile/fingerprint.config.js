/**
 * Runtime fingerprint overrides for `runtimeVersion.policy = "fingerprint"`.
 *
 * @type {import("expo/fingerprint").Config}
 */
const config = {
  ignorePaths: [
    // Fetched Stockfish sources + NNUE nets (SIMULATOR.md). Gitignored, ~66MB,
    // and only present after the iOS fetch — an EAS build that has downloaded
    // them would otherwise hash a different tree than `eas update` on CI or a
    // laptop where ios/engine/ is absent. Safe to ignore because:
    // - modules/stockfish/ios/engine.pin.json (tag sf_16.1 + sha256 of the
    //   tarball and both nets) sits in the autolinked ios directory and is hashed
    // - StockfishModule.swift, stockfish-shim.cpp, stockfish-bridge.h, and
    //   Stockfish.podspec are not matched by this pattern
    // The rest of modules/stockfish is not ignored.
    "modules/stockfish/ios/engine/**/*",
  ],
};

module.exports = config;
