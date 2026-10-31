// Expo SDK 54+ auto-detects pnpm monorepos — avoid manual watchFolders/nodeModulesPaths
// (those break pnpm isolated installs and cause "Unable to resolve" on reload/HMR).
const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

// Web export/dev: lottie-react-native pulls optional `@lottiefiles/dotlottie-react`.
// Stub it locally — no lockfile change; native Android/iOS unchanged.
const dotlottieStub = path.resolve(__dirname, "src/web/dotlottie-react.stub.tsx");
const prevResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@lottiefiles/dotlottie-react") {
    return { type: "sourceFile", filePath: dotlottieStub };
  }
  if (prevResolve) return prevResolve(context, moduleName, platform);
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
