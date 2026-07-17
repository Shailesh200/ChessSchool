import { expect, type Page } from "@playwright/test";

/** Register a fresh user and attach the session cookie for browser navigations. */
export async function enrollWeb(
  page: Page,
  opts?: { email?: string; password?: string; name?: string },
) {
  const stamp = Date.now();
  const email = opts?.email ?? `e2e-${stamp}@test.dev`;
  const password = opts?.password ?? "testpass123";
  const name = opts?.name ?? "E2E Student";
  const base = process.env.BASE_URL || "http://localhost:3210";

  const res = await page.request.post(`${base}/api/auth/register`, {
    data: { email, password, name },
  });
  expect(res.ok(), `register failed: ${res.status()} ${await res.text()}`).toBeTruthy();
  const body = (await res.json()) as { token?: string };
  expect(body.token).toBeTruthy();

  await page.context().addCookies([
    {
      name: "chessschool_session",
      value: body.token!,
      url: base,
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);

  // Seed persisted session so EnrollGate can pass before ProgressSync finishes.
  await page.addInitScript(
    ({ userName }) => {
      localStorage.setItem(
        "chessschool.session",
        JSON.stringify({
          state: {
            authed: true,
            user: { name: userName, role: "student" },
            isAdmin: false,
          },
          version: 0,
        }),
      );
    },
    { userName: name },
  );

  return { email, password, name, token: body.token! };
}
