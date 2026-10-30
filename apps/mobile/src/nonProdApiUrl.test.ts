import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import appConfig from "../app.config";

vi.hoisted(() => {
  Object.assign(globalThis, { __DEV__: false });
});

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("expo-secure-store", () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock("expo-constants", () => ({ default: { expoConfig: null } }));

const mobileRoot = path.resolve(__dirname, "..");
const appJson = JSON.parse(readFileSync(path.join(mobileRoot, "app.json"), "utf8")) as {
  expo: { plugins: unknown; slug?: string };
};

const ENV_KEYS = [
  "EAS_BUILD_PROFILE",
  "APP_VARIANT",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_QA_SIM",
  "EAS_BUILD_GIT_COMMIT_HASH",
] as const;

const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
  vi.unstubAllEnvs();
  vi.resetModules();
});

/** Resolve app.config.ts with an explicit profile, the way EAS or a local prebuild does. */
function resolve(env: Record<string, string | undefined> = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  const config = structuredClone(appJson.expo);
  return appConfig({ config, projectRoot: mobileRoot } as never);
}

const TEST_HOST = "https://chess-school-test.vercel.app";
const PROD_URLS = [
  "https://www.chess-school.in",
  "https://chess-school.in",
  "http://chess-school.in/play",
  "https://api.chess-school.in",
];

/** Local Gradle sets APP_VARIANT. An EAS profile named test sets EAS_BUILD_PROFILE. */
const TEST_PROFILES: Record<string, string>[] = [
  { APP_VARIANT: "test" },
  { EAS_BUILD_PROFILE: "test" },
];

describe("non-production builds cannot target the production API", () => {
  for (const profile of TEST_PROFILES) {
    const label =
      profile.APP_VARIANT !== undefined
        ? `APP_VARIANT=${profile.APP_VARIANT}`
        : `EAS_BUILD_PROFILE=${profile.EAS_BUILD_PROFILE}`;

    it(`${label} with an unset API URL fails`, () => {
      expect(() => resolve(profile)).toThrow(/EXPO_PUBLIC_API_URL/);
      expect(() => resolve({ ...profile, EXPO_PUBLIC_API_URL: "   " })).toThrow(
        /EXPO_PUBLIC_API_URL/,
      );
    });

    it(`${label} with a chess-school.in URL fails`, () => {
      for (const url of PROD_URLS) {
        expect(() => resolve({ ...profile, EXPO_PUBLIC_API_URL: url }), url).toThrow(
          /chess-school\.in/,
        );
      }
    });

    it(`${label} with chess-school-test.vercel.app passes`, () => {
      const resolved = resolve({ ...profile, EXPO_PUBLIC_API_URL: TEST_HOST });
      expect(resolved.slug).toBe("chess-school");
      expect(resolved.plugins).toEqual(appJson.expo.plugins);
    });
  }

  it("guards closed-test, preview, development, and qa-sim the same way", () => {
    for (const name of ["closed-test", "preview", "development", "qa-sim"]) {
      expect(() => resolve({ EAS_BUILD_PROFILE: name }), name).toThrow(/EXPO_PUBLIC_API_URL/);
      expect(() =>
        resolve({
          EAS_BUILD_PROFILE: name,
          EXPO_PUBLIC_API_URL: "https://www.chess-school.in",
        }),
      ).toThrow(/chess-school\.in/);
    }
    const preview = resolve({
      EAS_BUILD_PROFILE: "preview",
      EXPO_PUBLIC_API_URL: TEST_HOST,
    });
    expect(preview.plugins).toEqual(appJson.expo.plugins);
    const development = resolve({
      EAS_BUILD_PROFILE: "development",
      EXPO_PUBLIC_API_URL: "http://localhost:3000",
    });
    expect(development.plugins).toEqual(appJson.expo.plugins);
  });

  it("production is unchanged", () => {
    for (const env of [
      { EAS_BUILD_PROFILE: "production" },
      {
        EAS_BUILD_PROFILE: "production",
        EXPO_PUBLIC_API_URL: "https://www.chess-school.in",
      },
      { EAS_BUILD_PROFILE: "production", EXPO_PUBLIC_API_URL: "https://chess-school.in" },
      {},
      { APP_VARIANT: "production" },
      {
        EAS_BUILD_PROFILE: "production",
        APP_VARIANT: "test",
        EXPO_PUBLIC_API_URL: "https://www.chess-school.in",
      },
    ]) {
      expect(() => resolve(env), JSON.stringify(env)).not.toThrow();
    }

    const api = readFileSync(path.join(mobileRoot, "src/api.ts"), "utf8");
    const constants = readFileSync(path.join(mobileRoot, "src/constants.ts"), "utf8");
    const online = readFileSync(path.join(mobileRoot, "app/play/online/[id].tsx"), "utf8");
    expect(api).toContain('return "https://www.chess-school.in"');
    expect(constants).toContain('"https://www.chess-school.in"');
    expect(online).toContain('"https://www.chess-school.in"');
  });

  it("keeps the release fallback when EXPO_PUBLIC_API_URL is unset", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "");
    delete process.env.EXPO_PUBLIC_QA_SIM;
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EAS_BUILD_PROFILE;
    delete process.env.APP_VARIANT;
    vi.resetModules();
    const api = await import("./api");
    const constants = await import("./constants");
    expect(api.API_URL).toBe("https://www.chess-school.in");
    expect(constants.PRODUCTION_URL).toBe("https://www.chess-school.in");
    expect(constants.PRIVACY_URL).toBe("https://www.chess-school.in/privacy");
    expect(constants.SUPPORT_EMAIL).toBe("support@chess-school.in");
  });
});
