import { describe, expect, it } from "vitest";
import { clientIp } from "./rate-limit";

describe("rate-limit Vercel IP trust (DP-X-012)", () => {
  it("does not treat x-real-ip as the client address off Vercel", () => {
    const prev = process.env.VERCEL;
    delete process.env.VERCEL;
    try {
      const req = new Request("http://test", {
        headers: { "x-real-ip": "203.0.113.99" },
      });
      expect(clientIp(req)).toBe("local");
    } finally {
      if (prev === undefined) delete process.env.VERCEL;
      else process.env.VERCEL = prev;
    }
  });
});
