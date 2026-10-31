import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getApiUser: vi.fn(async () => null as { id: string } | null),
  enforceRateLimit: vi.fn(async () => null as Response | null),
  userShareAnalyticsOptIn: vi.fn(async () => false),
  insertAnalyticsEvents: vi.fn(async () => undefined),
}));

vi.mock("@/lib/auth", () => ({ getApiUser: mocks.getApiUser }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/analytics/account-consent.server", () => ({
  userShareAnalyticsOptIn: mocks.userShareAnalyticsOptIn,
}));
vi.mock("@/lib/analytics/serverInsert", () => ({
  insertAnalyticsEvents: mocks.insertAnalyticsEvents,
}));

import { POST } from "./route";

const batch = {
  events: [{ name: "lesson_start", props: { id: "1" }, sessionId: "sess-1" }],
};

function post(body: unknown = batch): Request {
  return new Request("http://localhost/api/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.getApiUser.mockResolvedValue(null);
  mocks.enforceRateLimit.mockResolvedValue(null);
  mocks.userShareAnalyticsOptIn.mockResolvedValue(false);
  mocks.insertAnalyticsEvents.mockClear();
});

describe("POST /api/events", () => {
  it("returns 401 and stores nothing when there is no session", async () => {
    const res = await POST(post());
    expect(res.status).toBe(401);
    expect(mocks.insertAnalyticsEvents).not.toHaveBeenCalled();
    expect(mocks.userShareAnalyticsOptIn).not.toHaveBeenCalled();
  });

  it("returns 204 and stores nothing when signed in but not opted in", async () => {
    mocks.getApiUser.mockResolvedValue({ id: "u1" });
    mocks.userShareAnalyticsOptIn.mockResolvedValue(false);
    const res = await POST(post());
    expect(res.status).toBe(204);
    expect(mocks.userShareAnalyticsOptIn).toHaveBeenCalledWith("u1");
    expect(mocks.insertAnalyticsEvents).not.toHaveBeenCalled();
  });

  it("stores events when signed in and opted in", async () => {
    mocks.getApiUser.mockResolvedValue({ id: "u1" });
    mocks.userShareAnalyticsOptIn.mockResolvedValue(true);
    const res = await POST(post());
    expect(res.status).toBe(200);
    expect(mocks.insertAnalyticsEvents).toHaveBeenCalledWith([
      expect.objectContaining({
        name: "lesson_start",
        userId: "u1",
        sessionId: "sess-1",
      }),
    ]);
  });
});
