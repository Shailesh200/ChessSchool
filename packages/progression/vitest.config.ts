import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    // enrollPrompt.test.ts is a pre-existing unrun case with a bad fixture; don't fold it in here.
    include: ["src/day.test.ts"],
  },
});
