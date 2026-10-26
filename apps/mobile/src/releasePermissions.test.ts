import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { describe, expect, it } from "vitest";

type AndroidManifest = {
  manifest: {
    $: Record<string, string | undefined>;
    application?: Array<{
      $: { "android:name": string };
      service?: Array<{ $: { "android:name": string; "tools:node"?: string } }>;
    }>;
  };
};

type RemoveExpoAudioServicesPlugin = {
  EXPO_AUDIO_FOREGROUND_SERVICES: readonly string[];
  removeExpoAudioForegroundServices: (manifest: AndroidManifest) => AndroidManifest;
};

type ExpoAudioPluginOptions = {
  microphonePermission?: string | false;
  recordAudioAndroid?: boolean;
  enableBackgroundRecording?: boolean;
};

const FOREGROUND_SERVICE_PERMISSIONS = [
  "android.permission.FOREGROUND_SERVICE",
  "android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK",
  "android.permission.FOREGROUND_SERVICE_MICROPHONE",
] as const;

const REMOVE_EXPO_AUDIO_SERVICES_PLUGIN =
  "./plugins/withRemoveExpoAudioForegroundServices.js";

type AppConfig = {
  expo: {
    ios?: {
      config?: { usesNonExemptEncryption?: boolean };
      infoPlist?: Record<string, unknown>;
    };
    android?: { permissions?: string[]; blockedPermissions?: string[] };
    plugins?: Array<string | [string, unknown]>;
  };
};

const appJsonPath = path.resolve(__dirname, "../app.json");
const app = JSON.parse(readFileSync(appJsonPath, "utf8")) as AppConfig;

function expoAudioOptions(): ExpoAudioPluginOptions {
  const entry = app.expo.plugins?.find(
    (plugin) => Array.isArray(plugin) && plugin[0] === "expo-audio",
  );
  expect(
    entry,
    "expo-audio must be configured with options, not as a bare plugin",
  ).toBeTruthy();
  return (entry as [string, ExpoAudioPluginOptions])[1];
}

describe("release permission config (CS-12)", () => {
  it("does not request the microphone on Android or iOS", () => {
    const permissions = app.expo.android?.permissions ?? [];
    const blocked = app.expo.android?.blockedPermissions ?? [];
    const audio = expoAudioOptions();
    const source = readFileSync(appJsonPath, "utf8");

    expect(permissions).not.toContain("android.permission.RECORD_AUDIO");
    expect(blocked).toContain("android.permission.RECORD_AUDIO");
    expect(audio.recordAudioAndroid).toBe(false);
    expect(audio.microphonePermission).toBe(false);
    expect(source).not.toContain("NSMicrophoneUsageDescription");
    expect(app.expo.ios?.infoPlist?.NSMicrophoneUsageDescription).toBeUndefined();
  });

  it("keeps playback and haptics permissions", () => {
    const permissions = app.expo.android?.permissions ?? [];
    expect(permissions).toContain("android.permission.MODIFY_AUDIO_SETTINGS");
    expect(permissions).toContain("android.permission.VIBRATE");
    expect(app.expo.android?.blockedPermissions ?? []).not.toContain(
      "android.permission.MODIFY_AUDIO_SETTINGS",
    );
  });

  it("declares standard HTTPS encryption for TestFlight export compliance", () => {
    expect(app.expo.ios?.config?.usesNonExemptEncryption).toBe(false);
  });

  it("blocks expo-audio foreground-service permissions", () => {
    const permissions = app.expo.android?.permissions ?? [];
    const blocked = app.expo.android?.blockedPermissions ?? [];
    const audio = expoAudioOptions();

    expect(audio.enableBackgroundRecording).toBe(false);
    for (const permission of FOREGROUND_SERVICE_PERMISSIONS) {
      expect(permissions, permission).not.toContain(permission);
      expect(blocked, permission).toContain(permission);
    }
    expect(blocked).toContain("android.permission.RECORD_AUDIO");
  });

  it("removes both expo-audio foreground services from the merged manifest", () => {
    expect(app.expo.plugins).toContain(REMOVE_EXPO_AUDIO_SERVICES_PLUGIN);

    const require = createRequire(path.join(__dirname, "../package.json"));
    const plugin =
      require("./plugins/withRemoveExpoAudioForegroundServices.js") as RemoveExpoAudioServicesPlugin;
    const audioRoot = path.dirname(require.resolve("expo-audio/package.json"));
    const libraryManifest = readFileSync(
      path.join(audioRoot, "android/src/main/AndroidManifest.xml"),
      "utf8",
    );
    const relativeNames = [
      ...libraryManifest.matchAll(/android:name="(\.service\.[^"]+)"/g),
    ].map((match) => match[1]);
    const qualifiedNames = relativeNames.map((name) => `expo.modules.audio${name}`);

    expect(relativeNames).toEqual([
      ".service.AudioControlsService",
      ".service.AudioRecordingService",
    ]);
    expect(qualifiedNames).toEqual([...plugin.EXPO_AUDIO_FOREGROUND_SERVICES]);

    const manifest: AndroidManifest = {
      manifest: {
        $: { "xmlns:android": "http://schemas.android.com/apk/res/android" },
        application: [{ $: { "android:name": ".MainApplication" } }],
      },
    };
    const next = plugin.removeExpoAudioForegroundServices(manifest);
    const services = next.manifest.application?.[0]?.service ?? [];

    expect(next.manifest.$["xmlns:tools"]).toBe("http://schemas.android.com/tools");
    expect(services).toEqual(
      plugin.EXPO_AUDIO_FOREGROUND_SERVICES.map((name) => ({
        $: { "android:name": name, "tools:node": "remove" },
      })),
    );
  });
});
