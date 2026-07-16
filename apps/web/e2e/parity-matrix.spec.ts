import { test, expect } from "@playwright/test";
// Playwright compiles specs as CJS — load JSON manifest without ESM node: imports.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const manifest = require("../../../scripts/parity-routes.json") as {
  accounts: { local: { email: string; password: string } };
  screens: {
    id: string;
    label: string;
    auth?: "guest" | "user";
    web: { path: string; readyText?: string };
    semantic?: string[];
  }[];
};

const account = manifest.accounts.local;
const guestScreens = manifest.screens.filter((s) => s.auth !== "user");
const userScreens = manifest.screens.filter((s) => s.auth === "user");

async function loginWeb(page: import("@playwright/test").Page) {
  const base = process.env.BASE_URL || "http://localhost:3210";
  const res = await page.request.post(`${base}/api/auth/login`, {
    data: { email: account.email, password: account.password },
  });
  expect(res.ok()).toBeTruthy();
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
}

async function visibleCopy(page: import("@playwright/test").Page, text: string, timeout = 10_000) {
  const heading = page.getByRole("heading", { name: text, exact: false });
  if ((await heading.count()) > 0) {
    await expect(heading.first()).toBeVisible({ timeout });
    return;
  }
  await expect(page.getByText(text, { exact: false }).first()).toBeVisible({ timeout });
}

async function assertScreen(page: import("@playwright/test").Page, screen: (typeof manifest.screens)[number]) {
  await page.goto(screen.web.path, { waitUntil: "domcontentloaded" });
  if (screen.web.readyText) {
    await visibleCopy(page, screen.web.readyText, 15_000);
  }
  for (const text of screen.semantic ?? []) {
    await visibleCopy(page, text);
  }
}

/** Semantic parity — PWA mweb must expose the same copy/structure as native (visual diff is parity:compare). */
test.describe("parity matrix (PWA mweb semantics)", () => {
  test.use({ viewport: { width: 393, height: 852 } });
  test.describe.configure({ mode: "serial" });

  for (const screen of guestScreens) {
    test(`"${screen.id}" — ${screen.label}`, async ({ page }) => {
      await assertScreen(page, screen);
    });
  }

  test.describe("signed-in screens", () => {
  for (const screen of userScreens) {
    test(`"${screen.id}" — ${screen.label}`, async ({ page }) => {
      await loginWeb(page);
      await assertScreen(page, screen);
    });
  }
  });
});
