import type { OtaRecord } from "../src";

let n = 0;
/** A stored update with one launch asset and one image. */
export function update(over: Partial<OtaRecord> = {}): OtaRecord {
  n++;
  const created = new Date(Date.UTC(2026, 10, 1, 0, n)).toISOString();
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`,
    kind: "update",
    channel: "production",
    runtimeVersion: "1.0.0",
    platform: "ios",
    createdAt: created,
    message: `update ${n}`,
    rolloutPercent: 100,
    paused: false,
    body: {
      launchAsset: { hash: "bHVuY2g", key: "launchkey", contentType: "application/javascript", storageKey: "assets/launch" },
      assets: [{ hash: "aW1n", key: "imgkey", contentType: "image/png", fileExtension: ".png", storageKey: "assets/img" }],
      extra: { expoClient: { name: "Demo", version: "1.0.0" } },
    },
    ...over,
  };
}

/** Headers expo-updates sends on an update check. */
export function expoHeaders(over: Record<string, string> = {}): Record<string, string> {
  return {
    accept: "multipart/mixed,application/expo+json,application/json",
    "expo-protocol-version": "1",
    "expo-platform": "ios",
    "expo-runtime-version": "1.0.0",
    "expo-channel-name": "production",
    "eas-client-id": "8e1c8f6c-7d2a-4d61-9a4c-1f2b3c4d5e6f",
    "expo-embedded-update-id": "11111111-1111-4111-8111-111111111111",
    "expo-current-update-id": "11111111-1111-4111-8111-111111111111",
    ...over,
  };
}
