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

  it("does not create or link an account when Google says the email is unverified", async () => {
    const res = await signInWithGoogle({
      sub: "sub-unverified",
      email: "unverified@test.dev",
      name: "Nope",
      emailVerified: false,
    });
    expect(res).toEqual({ error: "Google did not verify this email." });
    expect(await db.select().from(schema.users)).toHaveLength(0);
    expect(await db.select().from(schema.oauthAccounts)).toHaveLength(0);
  });

  it("concurrent Google signups for one verified email share a single account", async () => {
    const email = "google-race@test.dev";
    const [a, b] = await Promise.all([
      signInWithGoogle({
        sub: "sub-race-a",
        email,
        name: "Racer A",
        emailVerified: true,
      }),
      signInWithGoogle({
        sub: "sub-race-b",
        email,
        name: "Racer B",
        emailVerified: true,
      }),
    ]);
    expect("error" in a).toBe(false);
    expect("error" in b).toBe(false);
    if ("error" in a || "error" in b) return;
    expect(a.user.id).toBe(b.user.id);
    const fresh = [a, b].filter((r) => r.isNewUser);
    const linked = [a, b].filter((r) => !r.isNewUser);
    expect(fresh).toHaveLength(1);
    expect(linked).toHaveLength(1);

    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, email));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(a.user.id);
    const oauth = await db
      .select()
      .from(schema.oauthAccounts)
      .where(eq(schema.oauthAccounts.userId, a.user.id));
    expect(oauth.map((row) => row.providerAccountId).sort()).toEqual([
      "sub-race-a",
      "sub-race-b",
    ]);
  });
});
