import { afterEach, describe, expect, it, vi } from "vitest";

async function loadSupportEmail(): Promise<string> {
  vi.resetModules();
  const mod = await import("./constants");
  return mod.SUPPORT_EMAIL;
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("SUPPORT_EMAIL", () => {
  it("is the public chess-school.in inbox in release builds", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "");
    expect(await loadSupportEmail()).toBe("support@chess-school.in");
  });

  it("is empty in qa-sim builds so the production host stays out of the bundle", async () => {
    vi.stubEnv("EXPO_PUBLIC_QA_SIM", "1");
    expect(await loadSupportEmail()).toBe("");
  });
});
