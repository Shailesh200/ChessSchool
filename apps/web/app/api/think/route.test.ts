import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { bootApiTestEnv } from "@/lib/test-db.harness";

vi.mock("@/lib/auth", () => ({
  getApiUser: vi.fn(async () => null),
}));

describe("/api/think", () => {
  let teardown: () => void = () => {};

  beforeEach(async () => {
    vi.resetModules();
    ({ teardown } = await bootApiTestEnv());
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("applies guest rate limiting instead of serving anonymously without limits", async () => {
    const { GET, resetThinkPoolForTests } = await import("@/app/api/think/route");
    resetThinkPoolForTests();
    const url = "http://test/api/think?day=2026-01-01&n=0";
    const req = () =>
      new NextRequest(url, { headers: { "x-forwarded-for": "203.0.113.55" } });
    for (let i = 0; i < 60; i++) {
      const res = await GET(req());
      expect(res.status).not.toBe(429);
    }
    const blocked = await GET(req());
    expect(blocked.status).toBe(429);
  });
});
