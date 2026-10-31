import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

const releaseRoot = fileURLToPath(
  new URL("../../scripts/release/", import.meta.url),
);

export default defineConfig({
  test: {
    root: releaseRoot,
    include: ["**/*.test.mjs"],
  },
});
