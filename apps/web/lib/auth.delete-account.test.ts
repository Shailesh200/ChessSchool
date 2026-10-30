import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { deleteUserAccount } from "@/lib/auth";
import { bootApiTestEnv } from "@/lib/test-db.harness";
import * as schema from "@/db/schema";
import { eq } from "drizzle-orm";

describe("deleteUserAccount", () => {
  it("rolls back when a later delete fails", async () => {
    const { teardown, db } = await bootApiTestEnv();
    const id = `delete-${randomUUID()}`;
    const now = Date.now();
    try {
      await db.insert(schema.users).values({
        id,
        email: `${id}@test.dev`,
        passwordHash: "x",
        name: "Delete",
        role: "student",
        createdAt: now,
      });
      await db.insert(schema.progress).values({ userId: id, updatedAt: now });
      await db.run(`
        CREATE TRIGGER cs23_fail_user_delete
        BEFORE DELETE ON users
        BEGIN
          SELECT RAISE(ABORT, 'simulated delete failure');
        END
      `);
      const res = await deleteUserAccount(id);
      expect(res).toEqual({ error: "Could not delete account. Try again." });
      expect(
        (await db.select().from(schema.users).where(eq(schema.users.id, id))).length,
      ).toBe(1);
      expect(
        (await db.select().from(schema.progress).where(eq(schema.progress.userId, id)))
          .length,
      ).toBe(1);
    } finally {
      await db.run(`DROP TRIGGER IF EXISTS cs23_fail_user_delete`);
      teardown();
    }
  });
});
