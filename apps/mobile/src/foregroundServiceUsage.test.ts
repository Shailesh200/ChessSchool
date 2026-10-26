import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const mobileRoot = path.resolve(__dirname, "..");

/**
 * These start expo-audio foreground services or need recording permissions.
 * The config plugin strips those services and permissions from the Android
 * manifest, and starting a stripped service crashes at runtime.
 */
const FORBIDDEN_AUDIO_APIS = [
  "setActiveForLockScreen",
  "allowsBackgroundRecording",
  "shouldPlayInBackground",
  "useAudioRecorder",
  "AudioRecorder",
  "RecordingPresets",
  "requestRecordingPermissionsAsync",
] as const;

const SOURCE_ROOTS = ["src", "app"] as const;

function sourceFiles(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(full));
      continue;
    }
    if (!entry.isFile()) continue;
    if (!/\.tsx?$/.test(entry.name)) continue;
    if (/\.test\./.test(entry.name)) continue;
    files.push(full);
  }
  return files;
}

describe("foreground service usage", () => {
  it("does not call expo-audio APIs that start stripped Android services", () => {
    const hits: string[] = [];
    for (const root of SOURCE_ROOTS) {
      for (const file of sourceFiles(path.join(mobileRoot, root))) {
        const source = readFileSync(file, "utf8");
        for (const api of FORBIDDEN_AUDIO_APIS) {
          if (new RegExp(`\\b${api}\\b`).test(source)) {
            hits.push(`${path.relative(mobileRoot, file)} uses ${api}`);
          }
        }
      }
    }
    expect(hits, hits.join("\n")).toEqual([]);
  });
});
