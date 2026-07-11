import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next", "e2e/**"],
    coverage: {
      provider: "v8",
      include: [
        "lib/api-schemas.ts",
        "lib/game-session-seat.ts",
        "lib/progress-merge.ts",
        "lib/session-secret.ts",
        "features/lessons/unlock.ts",
        "core/backup/backup.ts",
      ],
      exclude: ["**/*.test.ts", "**/*.spec.ts", "**/node_modules/**"],
      reporter: ["text", "text-summary"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 85,
        statements: 90,
      },
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(
        new URL("./lib/vitest-server-only-stub.ts", import.meta.url),
      ),
    },
  },
});
