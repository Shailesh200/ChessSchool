import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiUser: vi.fn(async () => null as { id: string } | null),
  enforceRateLimit: vi.fn(async () => null as Response | null),
  ttsConfigured: vi.fn(() => true),
  synthesizeCoachSpeech: vi.fn(
    async () => Buffer.from([0x49, 0x44, 0x33]) as Buffer | null,
  ),
}));

vi.mock("@/lib/auth", () => ({ getApiUser: mocks.getApiUser }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/tts/synthesize.server", () => ({
  ttsConfigured: mocks.ttsConfigured,
  synthesizeCoachSpeech: mocks.synthesizeCoachSpeech,
}));

import { POST } from "./route";

function post(body: unknown): Request {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.getApiUser.mockResolvedValue(null);
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.ttsConfigured.mockReturnValue(true);
  mocks.synthesizeCoachSpeech.mockResolvedValue(Buffer.from([0x49, 0x44, 0x33]));
});

describe("POST /api/tts caching (DP-X-016)", () => {
  it("returns audio that shared caches and the browser must not store", async () => {
    const res = await POST(post({ text: "Nice move!" }));
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("audio/mpeg");
    const cc = (res.headers.get("cache-control") ?? "").toLowerCase();
    expect(cc).toContain("private");
    expect(cc).toContain("no-store");
    expect(cc).not.toMatch(/public|immutable|max-age=[1-9]/);
    expect((await res.arrayBuffer()).byteLength).toBe(3);
  });

  it("still returns the audio bytes for a signed-in caller", async () => {
    mocks.getApiUser.mockResolvedValue({ id: "u1" });
    const res = await POST(post({ text: "Well played." }));
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("no-store");
  });
});
