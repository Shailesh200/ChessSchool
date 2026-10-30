// Expo SDK 54+ auto-detects pnpm monorepos — avoid manual watchFolders/nodeModulesPaths
// (those break pnpm isolated installs and cause "Unable to resolve" on reload/HMR).
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getSentryExpoConfig(__dirname);
config.resolver.assetExts = [...config.resolver.assetExts, "woff2"];

module.exports = config;
