import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { eq } from "drizzle-orm";
import { sessions, users } from "@/db/schema";
import { bootApiTestEnv, type TestDb } from "@/lib/test-db.harness";
import { hashSessionToken } from "@/lib/session-token";

const PW = "testpass123";
const SESSION_COOKIE = "chessschool_session";

/**
 * Same shape as Next's sealed HeadersAdapter: a callable `.get`, plus a
 * `.headers` plain object that has no `.get`. `readClientIp` used to pick
 * `.headers` and throw on sign-up and login.
 */
const cookieJar = vi.hoisted(() => ({
  set: vi.fn<(name: string, value: string, options?: unknown) => void>(),
  get: vi.fn(() => undefined as { value: string } | undefined),
  delete: vi.fn(),
}));

vi.mock("next/headers", () => ({
  headers: async () => {
    const { HeadersAdapter } =
      await import("next/dist/server/web/spec-extension/adapters/headers");
    return HeadersAdapter.seal(
      HeadersAdapter.from({
        "x-real-ip": "203.0.113.44",
        "x-forwarded-for": "198.51.100.1, 10.0.0.2",
      }),
    );
  },
  cookies: async () => cookieJar,
}));

function form(entries: Record<string, string>): FormData {
  const body = new FormData();
  for (const [key, value] of Object.entries(entries)) body.set(key, value);
  return body;
}

function latestSessionToken(): string {
  const calls = cookieJar.set.mock.calls.filter((call) => call[0] === SESSION_COOKIE);
  const token = calls.at(-1)?.[1];
  expect(typeof token).toBe("string");
  expect(token && token.length).toBeGreaterThan(10);
  return token as string;
}

async function expectRedirect(
  path: string,
  run: () => Promise<unknown>,
): Promise<void> {
  let thrown: unknown;
  try {
    const result = await run();
    thrown = new Error(`expected redirect to ${path}, got ${JSON.stringify(result)}`);
  } catch (err) {
    thrown = err;
  }
  const digest =
    typeof thrown === "object" && thrown !== null && "digest" in thrown
      ? String((thrown as { digest?: unknown }).digest ?? "")
      : "";
  const detail = thrown instanceof Error ? thrown.message : String(thrown);
  expect(digest, detail).toContain("NEXT_REDIRECT;");
  expect(digest).toContain(`;${path};`);
}

async function expectSession(db: TestDb, email: string, token: string): Promise<void> {
  const user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  expect(user?.id).toBeTruthy();
  const row = (
    await db
      .select()
      .from(sessions)
      .where(eq(sessions.id, hashSessionToken(token)))
      .limit(1)
  )[0];
  expect(row?.userId).toBe(user?.id);
  expect(row?.id).not.toBe(token);
}

describe("auth server actions", () => {
  let teardown: () => void = () => {};
  let db: TestDb;
  let registerAction: typeof import("@/lib/auth-actions").registerAction;
  let loginAction: typeof import("@/lib/auth-actions").loginAction;

  beforeEach(async () => {
    cookieJar.set.mockReset();
    cookieJar.get.mockClear();
    cookieJar.delete.mockClear();
    vi.resetModules();
    const env = await bootApiTestEnv();
    teardown = env.teardown;
    db = env.db;
    const actions = await import("@/lib/auth-actions");
    registerAction = actions.registerAction;
    loginAction = actions.loginAction;
  });

  afterEach(() => {
    teardown();
    vi.resetModules();
  });

  it("registerAction sets a session cookie and session row", async () => {
    const email = "register-action@test.dev";
    await expectRedirect("/onboarding", () =>
      registerAction(
        undefined,
        form({ email, password: PW, name: "Register Student" }),
      ),
    );
    await expectSession(db, email, latestSessionToken());
    expect(
      cookieJar.set.mock.calls.some(
        (call) =>
          call[0] === SESSION_COOKIE &&
          typeof call[2] === "object" &&
          call[2] !== null &&
          (call[2] as { httpOnly?: boolean }).httpOnly === true,
      ),
    ).toBe(true);
  });

  it("loginAction sets a session cookie and session row", async () => {
    const email = "login-action@test.dev";
    const { registerUser } = await import("@/lib/auth");
    const registered = await registerUser(email, PW, "Login Student");
    expect(registered).toEqual({ ok: true });
    cookieJar.set.mockClear();

    await expectRedirect("/welcome", () =>
      loginAction(undefined, form({ email, password: PW })),
    );
    await expectSession(db, email, latestSessionToken());
    expect(await db.select().from(sessions)).toHaveLength(2);
  });
});
