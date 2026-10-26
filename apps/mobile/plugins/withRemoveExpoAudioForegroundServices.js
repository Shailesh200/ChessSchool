const { AndroidConfig, withAndroidManifest } = require("expo/config-plugins");

/**
 * expo-audio 1.1.1 declares these in android/src/main/AndroidManifest.xml as
 * `.service.AudioControlsService` and `.service.AudioRecordingService`.
 * The library namespace is `expo.modules.audio`, so the merger key is the
 * fully qualified class name. A leading-dot name in the app manifest would
 * resolve against `com.chessschool.app` and would not match.
 *
 * The config plugin's `enableBackgroundRecording: false` (the default) only
 * skips adding FOREGROUND_SERVICE_MICROPHONE. It does not remove these
 * services. There is no `enableBackgroundPlayback` option in this version.
 *
 * Playback via ExoPlayer does not start either service. AudioControlsService
 * starts only from setActiveForLockScreen(true). AudioRecordingService starts
 * only when allowsBackgroundRecording is true. Do not enable lock-screen
 * controls or background recording while these removals are in place.
 */
const EXPO_AUDIO_FOREGROUND_SERVICES = [
  "expo.modules.audio.service.AudioControlsService",
  "expo.modules.audio.service.AudioRecordingService",
];

function removeExpoAudioForegroundServices(androidManifest) {
  const manifest = AndroidConfig.Manifest.ensureToolsAvailable(androidManifest);
  const application = AndroidConfig.Manifest.getMainApplicationOrThrow(manifest);
  if (!application.service) application.service = [];

  for (const name of EXPO_AUDIO_FOREGROUND_SERVICES) {
    const existing = application.service.find(
      (service) => service.$["android:name"] === name,
    );
    if (existing) {
      existing.$["tools:node"] = "remove";
      continue;
    }
    application.service.push({
      $: {
        "android:name": name,
        "tools:node": "remove",
      },
    });
  }

  return manifest;
}

/** @type {import('expo/config-plugins').ConfigPlugin} */
function withRemoveExpoAudioForegroundServices(config) {
  return withAndroidManifest(config, (config) => {
    config.modResults = removeExpoAudioForegroundServices(config.modResults);
    return config;
  });
}

module.exports = withRemoveExpoAudioForegroundServices;
module.exports.EXPO_AUDIO_FOREGROUND_SERVICES = EXPO_AUDIO_FOREGROUND_SERVICES;
module.exports.removeExpoAudioForegroundServices = removeExpoAudioForegroundServices;
