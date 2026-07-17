import { defineConfig, devices } from "@playwright/test";

const isCI = !!process.env.CI;

/**
 * Local: system Chrome (channel: "chrome") — bundled Chromium download is often
 * blocked on this machine. CI: Playwright Chromium (installed in the workflow).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: isCI ? 1 : 0,
  reporter: [["list"]],
  // Stable names across darwin/linux so CI and local share baselines (M-072).
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3210",
    ...(isCI ? {} : { channel: "chrome" as const }),
    ...devices["Pixel 7"],
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=3210 SESSION_TOKEN_SECRET=e2e-test-session-token-secret pnpm start",
    url: "http://localhost:3210",
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: {
      SESSION_TOKEN_SECRET: "e2e-test-session-token-secret",
    },
  },
});
