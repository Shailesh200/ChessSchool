// Expo SDK 54+ auto-detects pnpm monorepos — avoid manual watchFolders/nodeModulesPaths
// (those break pnpm isolated installs and cause "Unable to resolve" on reload/HMR).
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

module.exports = config;
