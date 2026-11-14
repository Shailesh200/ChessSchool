// Expo's default Metro config, plus the debug IDs Sentry needs to match crash reports to source maps.
const { getSentryExpoConfig } = require("@sentry/react-native/metro");

module.exports = getSentryExpoConfig(__dirname);
