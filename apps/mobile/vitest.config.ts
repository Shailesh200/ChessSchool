import { defineConfig } from "vitest/config";
import path from "node:path";

/** Coach catalogs `require()` PNGs. Vitest runs them as ESM, so stub image assets. */
function stubImageRequires() {
  return {
    name: "stub-image-requires",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!/\.(tsx?|jsx?)$/.test(id) || !code.includes("require(")) return;
      const next = code.replace(
        /require\(\s*(['"])[^'"]+\.(?:png|jpe?g|webp|gif)\1\s*\)/g,
        "1",
      );
      if (next === code) return;
      return next;
    },
  };
}

export default defineConfig({
  plugins: [stubImageRequires()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    coverage: {
      provider: "v8",
      // Pure, framework-free logic — the load-bearing code. UI screens/components
      // need RNTL/Detox (tracked as follow-up in CODE_REVIEW.md) and are excluded
      // so the threshold reflects real logic coverage, not untestable view code.
      include: [
        "src/chess-utils.ts",
        "src/progress-utils.ts",
        "../../packages/progression/src/**/*.ts",
        "../../packages/core/src/**/*.ts",
      ],
      reporter: ["text", "text-summary"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
