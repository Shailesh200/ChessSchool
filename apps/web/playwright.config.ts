import { defineConfig, devices } from "@playwright/test";

/**
 * Drives the system Chrome (channel: "chrome") since the bundled Chromium
 * download is blocked in this environment. Reuses a running server if present.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  // Stable names across darwin/linux so CI and local share baselines (M-072).
  snapshotPathTemplate: "{testDir}/{testFilePath}-snapshots/{arg}{ext}",
  use: {
    baseURL: process.env.BASE_URL ?? "http://localhost:3210",
    channel: "chrome",
    ...devices["Pixel 7"],
    trace: "on-first-retry",
  },
  webServer: {
    command: "PORT=3210 SESSION_TOKEN_SECRET=e2e-test-session-token-secret pnpm start",
    url: "http://localhost:3210",
    reuseExistingServer: true,
    timeout: 120_000,
    env: {
      SESSION_TOKEN_SECRET: "e2e-test-session-token-secret",
    },
  },
});
