import { defineConfig } from "vitest/config";

/** No tests in this package yet. `passWithNoTests` keeps `turbo run test` green. */
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    passWithNoTests: true,
  },
});
