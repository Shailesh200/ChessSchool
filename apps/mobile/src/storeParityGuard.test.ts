import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ConfigContext } from "expo/config";
import appConfig from "../app.config";

const mobileRoot = path.resolve(__dirname, "..");
const hookPath = path.join(mobileRoot, "scripts/eas-build-pre-install.mjs");
const baseConfig = {
  config: { name: "ChessSchool", slug: "chess-school" },
} as ConfigContext;

const originalProfile = process.env.EAS_BUILD_PROFILE;
const originalFlag = process.env.EXPO_PUBLIC_PARITY;

afterEach(() => {
  restore("EAS_BUILD_PROFILE", originalProfile);
  restore("EXPO_PUBLIC_PARITY", originalFlag);
});

function restore(key: string, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function setEnv(profile: string | undefined, flag: string | undefined) {
  restore("EAS_BUILD_PROFILE", profile);
  restore("EXPO_PUBLIC_PARITY", flag);
}

function runHook(profile: string | undefined, flag: string | undefined) {
  const env: Record<string, string | undefined> = { ...process.env };
  restoreKey(env, "EAS_BUILD_PROFILE", profile);
  restoreKey(env, "EXPO_PUBLIC_PARITY", flag);
  const childEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(env)) {
    if (typeof value === "string") childEnv[key] = value;
  }
  return spawnSync("node", [hookPath], {
    env: childEnv as unknown as NodeJS.ProcessEnv,
    encoding: "utf8",
  });
}

function restoreKey(
  env: Record<string, string | undefined>,
  key: string,
  value: string | undefined,
) {
  if (value === undefined) delete env[key];
  else env[key] = value;
}

describe("app.config store parity guard", () => {
  it("loads when the flag is absent", () => {
    setEnv("production", undefined);
    expect(appConfig(baseConfig).slug).toBe("chess-school");
    setEnv("preview", undefined);
    expect(appConfig(baseConfig).name).toBe("ChessSchool");
  });

  it("loads for development and for local Expo when the flag is set", () => {
    setEnv("development", "1");
    expect(appConfig(baseConfig).slug).toBe("chess-school");
    setEnv(undefined, "1");
    expect(appConfig(baseConfig).slug).toBe("chess-school");
  });

  it("throws for production and preview when the flag is set to any value", () => {
    for (const profile of ["production", "preview"] as const) {
      for (const flag of ["1", "0", "false", ""]) {
        setEnv(profile, flag);
        expect(() => appConfig(baseConfig)).toThrow(
          new RegExp(`EAS profile "${profile}"[\\s\\S]*EXPO_PUBLIC_PARITY`),
        );
      }
    }
  });
});

describe("eas-build-pre-install", () => {
  it("is wired from the mobile package", () => {
    const pkg = JSON.parse(
      readFileSync(path.join(mobileRoot, "package.json"), "utf8"),
    ) as {
      scripts: Record<string, string>;
    };
    expect(pkg.scripts["eas-build-pre-install"]).toBe(
      "node scripts/eas-build-pre-install.mjs",
    );
  });

  it("exits 0 when a store profile does not have the flag", () => {
    for (const profile of ["production", "preview", "development", undefined]) {
      const result = runHook(profile, undefined);
      expect(result.status, result.stderr).toBe(0);
    }
  });

  it("exits 0 when a non-store profile has the flag", () => {
    const result = runHook("development", "1");
    expect(result.status, result.stderr).toBe(0);
    const local = runHook(undefined, "1");
    expect(local.status, local.stderr).toBe(0);
  });

  it("exits non-zero for production and preview when the flag is set", () => {
    for (const profile of ["production", "preview"] as const) {
      for (const flag of ["1", "0", ""]) {
        const result = runHook(profile, flag);
        expect(result.status, result.stdout).not.toBe(0);
        expect(result.stderr).toContain(profile);
        expect(result.stderr).toContain("EXPO_PUBLIC_PARITY");
      }
    }
  });
});
