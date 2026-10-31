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

async function load() {
  vi.resetModules();
  return import("./forgotPassword");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("forgotPasswordUrl", () => {
  it("is built from EXPO_PUBLIC_API_URL, not a hard-coded host", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "1");
    vi.stubEnv("EXPO_PUBLIC_API_URL", "http://10.0.2.2:3108");
    expect((await load()).FORGOT_PASSWORD_URL).toBe("http://10.0.2.2:3108/forgot-password");
  });

  it("does not double the slash when the base ends in one", async () => {
    const { forgotPasswordUrl } = await load();
    expect(forgotPasswordUrl("https://example.test/")).toBe("https://example.test/forgot-password");
    expect(forgotPasswordUrl("https://example.test")).toBe("https://example.test/forgot-password");
  });

  it("follows the app's API base: a different base gives a different link", async () => {
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://staging.example.test");
    const a = (await load()).FORGOT_PASSWORD_URL;
    vi.stubEnv("EXPO_PUBLIC_API_URL", "https://other.example.test");
    const b = (await load()).FORGOT_PASSWORD_URL;
    expect(a).toBe("https://staging.example.test/forgot-password");
    expect(b).toBe("https://other.example.test/forgot-password");
  });

  it("keeps the production host out of the module source (qa-sim safe)", () => {
    const src = readFileSync(path.join(__dirname, "forgotPassword.ts"), "utf8");
    expect(src).not.toMatch(/chess-school\.in/);
    expect(src).toMatch(/from "\.\/api"/);
  });
});

describe("login screen link", () => {
  const src = readFileSync(path.join(__dirname, "..", "app", "login.tsx"), "utf8");
  const block = src.slice(src.indexOf('testID="login-forgot-password"') - 200);

  it("exists, is a link with an accessibilityLabel, and opens FORGOT_PASSWORD_URL", () => {
    expect(src).toContain('testID="login-forgot-password"');
    const el = block.slice(0, block.indexOf("</Pressable>"));
    expect(el).toContain('accessibilityRole="link"');
    expect(el).toMatch(/accessibilityLabel="Forgot password\?/);
    expect(el).toContain("Linking.openURL(FORGOT_PASSWORD_URL)");
    expect(src).toContain('from "@/forgotPassword"');
  });

  it("is login-only (not shown in enroll mode) and its label wraps", () => {
    const el = block.slice(0, block.indexOf("</Pressable>"));
    expect(src.slice(src.indexOf('testID="login-forgot-password"') - 400, src.indexOf('testID="login-forgot-password"'))).toContain("!isRegister");
    expect(el).not.toContain("numberOfLines");
    expect(src).not.toMatch(/chess-school\.in/);
  });
});
