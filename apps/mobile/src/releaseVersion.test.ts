import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

type RuntimeVersion = string | { policy?: string };

type ExpoAppJson = {
  expo: {
    version: string;
    runtimeVersion: RuntimeVersion;
    ios: { buildNumber: string };
    android: { versionCode: number };
  };
};

const appJson = JSON.parse(
  readFileSync(path.join(__dirname, "../app.json"), "utf8"),
) as ExpoAppJson;

/**
 * `runtimeVersion.policy: "appVersion"` is Expo's appVersion policy: the
 * runtime version shipped to the store is `expo.version`.
 */
export function resolvedRuntimeVersion(expo: {
  version: string;
  runtimeVersion: RuntimeVersion;
}): string {
  const runtime = expo.runtimeVersion;
  if (typeof runtime === "string") return runtime;
  if (runtime.policy === "appVersion") return expo.version;
  throw new Error(`Unsupported runtimeVersion ${JSON.stringify(runtime)}`);
}

describe("mobile store version", () => {
  it("ships 0.3.0, with the next Android versionCode and iOS buildNumber", () => {
    const expo = appJson.expo;
    expect(expo.version).toBe("0.3.0");
    expect(expo.runtimeVersion).toEqual({ policy: "appVersion" });
    expect(resolvedRuntimeVersion(expo)).toBe("0.3.0");
    expect(expo.android.versionCode).toBe(27);
    expect(expo.ios.buildNumber).toBe("2");
  });
});
