// Expo SDK 54+ auto-detects pnpm monorepos — avoid manual watchFolders/nodeModulesPaths
// (those break pnpm isolated installs and cause "Unable to resolve" on reload/HMR).
const path = require("path");
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);

const appReact = path.dirname(require.resolve("react/package.json", { paths: [__dirname] }));
const appReactDom = path.dirname(require.resolve("react-dom/package.json", { paths: [__dirname] }));
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules ?? {}),
  react: appReact,
  "react-dom": appReactDom,
};

const shim = path.join(__dirname, "src/shims/dotlottie-react.web.js");
const previousResolve = config.resolver.resolveRequest;
const appOrigin = path.join(__dirname, "package.json");
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform === "web" && moduleName === "@lottiefiles/dotlottie-react") {
    return { type: "sourceFile", filePath: shim };
  }
  const resolve = typeof previousResolve === "function" ? previousResolve : context.resolveRequest;
  if (moduleName === "react" || moduleName === "react-dom" || moduleName.startsWith("react/")) {
    return resolve({ ...context, originModulePath: appOrigin }, moduleName, platform);
  }
  return resolve(context, moduleName, platform);
};

module.exports = config;
