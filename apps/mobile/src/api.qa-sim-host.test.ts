import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

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
const require = createRequire(path.join(mobileRoot, "package.json"));
const presetPath = require.resolve("babel-preset-expo");
const babel = require(
  require.resolve("@babel/core", { paths: [path.dirname(presetPath)] }),
) as {
  transformSync: (
    code: string,
    options: Record<string, unknown>,
  ) => { code: string | null };
};
const expoPkg = require.resolve("expo/package.json");
const metroPkg = require.resolve("metro/package.json", {
  paths: [path.dirname(expoPkg)],
});
const terser = require(
  require.resolve("terser", { paths: [path.dirname(metroPkg)] }),
) as {
  minify: (
    code: string,
    options: Record<string, unknown>,
  ) => Promise<{ code?: string }>;
};

const HOST = "chess-school.in";

async function loadApiUrl(): Promise<string> {
  vi.resetModules();
  const mod = await import("./api");
  return mod.API_URL;
}

async function loadPrivacyUrl(): Promise<string> {
  vi.resetModules();
  const mod = await import("./constants");
  return mod.PRIVACY_URL;
}

/** Production Metro path: inline EXPO_PUBLIC_* then terser dead-code elimination. */
async function productionBundle(
  filename: string,
  env: Record<string, string | undefined>,
): Promise<string> {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("EXPO_PUBLIC_")) {
      saved.set(key, process.env[key]);
      delete process.env[key];
    }
  }
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    const source = readFileSync(filename, "utf8");
    const transformed = babel.transformSync(source, {
      filename,
      babelrc: false,
      configFile: false,
      ast: false,
      sourceMaps: false,
      presets: [[presetPath, { reanimated: false }]],
      caller: {
        name: "metro",
        bundler: "metro",
        platform: "ios",
        isDev: false,
        isServer: false,
        isNodeModule: false,
        isHMREnabled: false,
      },
    });
    if (!transformed.code) throw new Error(`babel produced no code for ${filename}`);
    const minified = await terser.minify(transformed.code, {
      compress: {
        dead_code: true,
        conditionals: true,
        evaluate: true,
        booleans: true,
        unused: true,
        passes: 2,
      },
      mangle: false,
    });
    if (!minified.code) throw new Error(`terser produced no code for ${filename}`);
    return minified.code;
  } finally {
    for (const key of Object.keys(process.env)) {
      if (key.startsWith("EXPO_PUBLIC_")) delete process.env[key];
    }
    for (const [key, value] of saved) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production host when EXPO_PUBLIC_QA_SIM is unset", () => {
  it("keeps the release fallback and the apex-to-www rewrite", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "");
    delete process.env.EXPO_PUBLIC_QA_SIM;
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(await loadApiUrl()).toBe("https://www.chess-school.in");

    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://chess-school.in/play");
    expect(await loadApiUrl()).toBe("http://www.chess-school.in/play");

    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://chess-school.in");
    expect(await loadApiUrl()).toBe("https://www.chess-school.in");

    delete process.env.EXPO_PUBLIC_API_URL;
    expect(await loadPrivacyUrl()).toBe("https://www.chess-school.in/privacy");
  });
});

describe("production host when EXPO_PUBLIC_QA_SIM is 1", () => {
  it("drops the release fallback and the apex-to-www rewrite", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "1");
    delete process.env.EXPO_PUBLIC_API_URL;
    expect(await loadApiUrl()).toBe("http://localhost:3108");
    expect(await loadApiUrl()).not.toContain(HOST);

    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://chess-school.in/play");
    expect(await loadApiUrl()).toBe("http://chess-school.in/play");

    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://localhost:3108");
    expect(await loadPrivacyUrl()).toBe("http://localhost:3108/privacy");
    expect(await loadPrivacyUrl()).not.toContain(HOST);
  });

  it("removes the host literal from a production minify of the modules that embed it", async () => {
    const files = [
      path.join(mobileRoot, "src/api.ts"),
      path.join(mobileRoot, "src/constants.ts"),
      path.join(mobileRoot, "app/play/online/[id].tsx"),
    ];
    const qaEnv = {
      EXPO_PUBLIC_QA_SIM: "1",
      EXPO_PUBLIC_API_URL: "http://localhost:3108",
    };
    for (const file of files) {
      const bundled = await productionBundle(file, qaEnv);
      expect(bundled, file).not.toContain(HOST);
    }

    const releaseApi = await productionBundle(path.join(mobileRoot, "src/api.ts"), {});
    expect(releaseApi).toContain(HOST);
    expect(releaseApi).toContain("www.chess-school.in");
  });
});
