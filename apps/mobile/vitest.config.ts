import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Pure, framework-free logic — the load-bearing code. UI screens/components
      // need RNTL/Detox (tracked as follow-up in CODE_REVIEW.md) and are excluded
      // so the threshold reflects real logic coverage, not untestable view code.
      include: ["src/progression.ts", "src/progress-utils.ts", "src/chess-utils.ts"],
      reporter: ["text", "text-summary"],
      thresholds: { lines: 85, functions: 85, branches: 80, statements: 85 },
    },
  },
});
