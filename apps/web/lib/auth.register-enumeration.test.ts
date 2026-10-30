import { describe, expect, it } from "vitest";
import bcrypt from "bcryptjs";
import { registerWithToken } from "@/lib/auth";
import { bootApiTestEnv } from "@/lib/test-db.harness";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

const PW = "testpass123";

describe("registerUser enumeration", () => {
  it("returns the same generic error for an existing email after hashing", async () => {
    const { teardown, db } = await bootApiTestEnv();
    try {
      const email = `taken-${Date.now()}@test.dev`;
      expect(await registerWithToken(email, PW, "First")).toMatchObject({
        token: expect.any(String),
      });
      const before = performance.now();
      const again = await registerWithToken(email, PW, "Second");
      const elapsed = performance.now() - before;
      expect(again).toEqual({
        error: "Could not create an account with this email. Try signing in.",
      });
      expect(elapsed).toBeGreaterThan(20);
      const rows = await db.select().from(users).where(eq(users.email, email));
      expect(rows).toHaveLength(1);
      expect(await bcrypt.compare(PW, rows[0]!.passwordHash!)).toBe(true);
    } finally {
      teardown();
    }
  });
});
