import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { bootApiTestEnv } from "@/lib/test-db.harness";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";

describe("signInWithGoogle", () => {
  let teardown: () => void = () => {};
  let signInWithGoogle: typeof import("@/lib/auth").signInWithGoogle;
  let registerWithToken: typeof import("@/lib/auth").registerWithToken;
  let db: import("@/lib/test-db.harness").TestDb;

  beforeEach(async () => {
    vi.resetModules();
    const env = await bootApiTestEnv();
    teardown = env.teardown;
    db = env.db;
    signInWithGoogle = (await import("@/lib/auth")).signInWithGoogle;
    registerWithToken = (await import("@/lib/auth")).registerWithToken;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("creates a Google-only student with oauth link", async () => {
    const email = `google-new-${Date.now()}@test.dev`;
    const res = await signInWithGoogle({
      sub: `sub-${Date.now()}`,
      email,
      name: "Google New",
      emailVerified: true,
    });
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.isNewUser).toBe(true);
    expect(res.user.email).toBe(email);

    const oauth = await db
      .select()
      .from(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.userId, res.user.id));
    expect(oauth).toHaveLength(1);

    const user = (
      await db.select().from(schema.users).where(eq(schema.users.id, res.user.id))
    )[0];
    expect(user?.passwordHash).toBeNull();
  });

  it("links Google to an existing email/password account", async () => {
    const email = `google-link-${Date.now()}@test.dev`;
    const registered = await registerWithToken(email, "testpass123", "Existing");
    expect("error" in registered).toBe(false);
    if ("error" in registered) return;

    const sub = `sub-link-${Date.now()}`;
    const res = await signInWithGoogle({
      sub,
      email,
      name: "Existing",
      emailVerified: true,
    });
    expect("error" in res).toBe(false);
    if ("error" in res) return;
    expect(res.isNewUser).toBe(false);
    expect(res.user.id).toBe(registered.user.id);

    const oauth = await db
      .select()
      .from(schema.oauthAccounts)
      .where(
        and(
          eq(schema.oauthAccounts.provider, "google"),
          eq(schema.oauthAccounts.providerAccountId, sub),
        ),
      );
    expect(oauth).toHaveLength(1);
  });
});
