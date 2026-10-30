import { mkdtempSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import appConfig from "../app.config";

const mobileRoot = path.resolve(__dirname, "..");
const require = createRequire(import.meta.url);

type PluginEntry = string | [string, ...unknown[]];
type AppJson = { expo: { plugins: PluginEntry[]; android?: Record<string, unknown> } };
type EasProfile = {
  env?: Record<string, string>;
  android?: { env?: Record<string, string> };
};

const appJson = JSON.parse(
  readFileSync(path.join(mobileRoot, "app.json"), "utf8"),
) as AppJson;
const easRaw = readFileSync(path.join(mobileRoot, "eas.json"), "utf8");
const eas = JSON.parse(easRaw) as { build: Record<string, EasProfile> };

const PLUGIN_PATH = "./plugins/withQaSimNetworkSecurity.js";
const plugin = require("../plugins/withQaSimNetworkSecurity.js") as {
  (config: Record<string, unknown>): Record<string, unknown>;
  QA_SIM_CLEARTEXT_HOSTS: string[];
  NETWORK_SECURITY_CONFIG_REFERENCE: string;
  buildNetworkSecurityConfigXml: () => string;
  setNetworkSecurityConfig: (manifest: unknown) => unknown;
};

const ENV_KEYS = [
  "EAS_BUILD_PROFILE",
  "APP_VARIANT",
  "EXPO_PUBLIC_API_URL",
  "EXPO_PUBLIC_QA_SIM",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

/** Resolve app.config.ts the way EAS does for one build profile on Android. */
function resolve(profile: string | undefined, env: Record<string, string> = {}) {
  for (const key of ENV_KEYS) delete process.env[key];
  if (profile !== undefined) process.env.EAS_BUILD_PROFILE = profile;
  Object.assign(process.env, env);
  const config = structuredClone(appJson.expo) as never;
  return appConfig({ config, projectRoot: mobileRoot } as never);
}

function profileEnv(name: string): Record<string, string> {
  const profile = eas.build[name]!;
  return { ...profile.env, ...profile.android?.env };
}

const QA_SIM_ENV = profileEnv("qa-sim");
const OTHER_PROFILES = Object.keys(eas.build).filter((name) => name !== "qa-sim");

describe("qa-sim cleartext: only the qa-sim build allows plain HTTP", () => {
  it("lists the profiles under test", () => {
    expect(OTHER_PROFILES).toEqual(["development", "preview", "production"]);
    expect(QA_SIM_ENV.EXPO_PUBLIC_API_URL).toBe("http://10.0.2.2:3108");
  });

  it("keeps the committed app.json and eas.json free of any cleartext setting", () => {
    expect(JSON.stringify(appJson)).not.toMatch(
      /cleartext|networkSecurityConfig|QaSim/i,
    );
    expect(easRaw).not.toMatch(/cleartext|networkSecurityConfig/i);
    const buildProps = appJson.expo.plugins.find(
      (entry) => Array.isArray(entry) && entry[0] === "expo-build-properties",
    ) as [string, { android?: Record<string, unknown> }] | undefined;
    expect(buildProps?.[1].android).not.toHaveProperty("usesCleartextTraffic");
  });

  for (const name of ["development", "production"]) {
    it(`${name} keeps the app.json plugins, with no network security config or cleartext flag`, () => {
      const resolved = resolve(name, profileEnv(name));
      expect(resolved.plugins).toEqual(appJson.expo.plugins);
      expect(JSON.stringify(resolved)).not.toMatch(
        /cleartext|networkSecurityConfig|withQaSimNetworkSecurity/i,
      );
      expect(resolved.android).not.toHaveProperty("usesCleartextTraffic");
    });
  }

  it("preview keeps the app.json plugins when the API URL is not production", () => {
    const resolved = resolve("preview", {
      ...profileEnv("preview"),
      EXPO_PUBLIC_API_URL: "https://chess-school-test.vercel.app",
    });
    expect(resolved.plugins).toEqual(appJson.expo.plugins);
    expect(JSON.stringify(resolved)).not.toMatch(
      /cleartext|networkSecurityConfig|withQaSimNetworkSecurity/i,
    );
    expect(resolved.android).not.toHaveProperty("usesCleartextTraffic");
  });

  it("leaves the plugins alone when no EAS profile is set", () => {
    const resolved = resolve(undefined);
    expect(resolved.plugins).toEqual(appJson.expo.plugins);
  });

  it("adds the network security plugin once, last, on the qa-sim profile", () => {
    const resolved = resolve("qa-sim", QA_SIM_ENV);
    expect(resolved.plugins).toEqual([...appJson.expo.plugins, PLUGIN_PATH]);
    expect(resolved.android).not.toHaveProperty("usesCleartextTraffic");
    expect(JSON.stringify(resolved)).not.toMatch(/usesCleartextTraffic/);
  });

  it("applies only to the exact profile name qa-sim", () => {
    for (const profile of [
      "qa-sim-x",
      "qa-sim2",
      "QA-SIM",
      "Qa-Sim",
      " qa-sim",
      "qa-sim ",
      "qa",
      "sim",
      "",
    ]) {
      const resolved = resolve(profile, QA_SIM_ENV);
      expect(resolved.plugins, JSON.stringify(profile)).toEqual(appJson.expo.plugins);
    }
  });

  it("ignores EXPO_PUBLIC_QA_SIM when the profile is not qa-sim", () => {
    for (const name of [undefined, "development", "preview", "production"] as const) {
      const resolved = resolve(name, {
        ...(name ? profileEnv(name) : {}),
        EXPO_PUBLIC_QA_SIM: "1",
        ...(name === "preview"
          ? { EXPO_PUBLIC_API_URL: "https://chess-school-test.vercel.app" }
          : {}),
      });
      expect(resolved.plugins, String(name)).toEqual(appJson.expo.plugins);
    }
  });

  it("keeps EXPO_PUBLIC_QA_SIM out of the production and preview profiles", () => {
    for (const name of ["production", "preview"]) {
      expect(profileEnv(name), name).not.toHaveProperty("EXPO_PUBLIC_QA_SIM");
    }
  });

  it("still rejects a qa-sim build with a wrong API URL", () => {
    expect(() =>
      resolve("qa-sim", {
        ...QA_SIM_ENV,
        EXPO_PUBLIC_API_URL: "https://www.chess-school.in",
      }),
    ).toThrow(/EXPO_PUBLIC_API_URL/);
  });
});

describe("withQaSimNetworkSecurity plugin", () => {
  it("allows cleartext for exactly 10.0.2.2 and localhost and blocks it everywhere else", () => {
    expect(plugin.QA_SIM_CLEARTEXT_HOSTS).toEqual(["10.0.2.2", "localhost"]);
    const xml = plugin.buildNetworkSecurityConfigXml();
    expect(xml.match(/<base-config [^>]*>/g)).toEqual([
      '<base-config cleartextTrafficPermitted="false" />',
    ]);
    expect(xml.match(/<domain-config [^>]*>/g)).toEqual([
      '<domain-config cleartextTrafficPermitted="true">',
    ]);
    const domains = [
      ...xml.matchAll(/<domain includeSubdomains="false">([^<]*)<\/domain>/g),
    ].map((match) => match[1]);
    expect(domains).toEqual(["10.0.2.2", "localhost"]);
    expect(xml.match(/<domain[ >]/g)).toHaveLength(2);
    expect(xml).not.toMatch(/debug-overrides|trust-anchors|certificates|src="user"|\*/);
    expect(xml).not.toContain("usesCleartextTraffic");
    expect(xml).not.toContain("chess-school");
    expect(xml).not.toMatch(
      /cleartextTrafficPermitted="true"[\s\S]*cleartextTrafficPermitted="true"/,
    );
  });

  it("points the application at the config and sets no usesCleartextTraffic", () => {
    const manifest = {
      manifest: { application: [{ $: { "android:name": ".MainApplication" } }] },
    };
    plugin.setNetworkSecurityConfig(manifest);
    expect(manifest.manifest.application[0]!.$).toEqual({
      "android:name": ".MainApplication",
      "android:networkSecurityConfig": "@xml/network_security_config",
    });
  });

  it("registers a manifest mod and writes res/xml/network_security_config.xml under app/src/main", async () => {
    const result = plugin({ name: "x", slug: "x" }) as {
      mods: { android: Record<string, (config: unknown) => Promise<unknown>> };
    };
    expect(Object.keys(result.mods.android).sort()).toEqual(["dangerous", "manifest"]);
    const root = mkdtempSync(path.join(tmpdir(), "qa-sim-nsc-"));
    await result.mods.android.dangerous!({
      modRequest: { platformProjectRoot: root, platform: "android", projectRoot: root },
      modResults: {},
      mods: result.mods,
    } as never);
    const written = readFileSync(
      path.join(root, "app/src/main/res/xml/network_security_config.xml"),
      "utf8",
    );
    expect(written).toBe(plugin.buildNetworkSecurityConfigXml());
  });
});
