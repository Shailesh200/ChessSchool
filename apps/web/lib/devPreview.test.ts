import { describe, expect, it, vi } from "vitest";

const notFound = vi.fn(() => {
  throw new Error("not-found");
});

vi.mock("next/navigation", () => ({
  notFound: () => notFound(),
}));

describe("rejectProductionPreview", () => {
  it("404s fixture query params in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.resetModules();
    const { rejectProductionPreview } = await import("./devPreview");
    expect(() => rejectProductionPreview(true)).toThrow("not-found");
    expect(notFound).toHaveBeenCalled();
    vi.unstubAllEnvs();
  });

  it("allows fixture query params outside production", async () => {
    vi.stubEnv("NODE_ENV", "test");
    vi.resetModules();
    notFound.mockClear();
    const { rejectProductionPreview } = await import("./devPreview");
    expect(() => rejectProductionPreview(true)).not.toThrow();
    expect(notFound).not.toHaveBeenCalled();
    vi.unstubAllEnvs();
  });
});
