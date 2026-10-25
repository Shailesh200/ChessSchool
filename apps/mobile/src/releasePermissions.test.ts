import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type ExpoAudioPluginOptions = {
  microphonePermission?: string | false;
  recordAudioAndroid?: boolean;
};

type AppConfig = {
  expo: {
    ios?: { config?: { usesNonExemptEncryption?: boolean }; infoPlist?: Record<string, unknown> };
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
  expect(entry, "expo-audio must be configured with options, not as a bare plugin").toBeTruthy();
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
});
