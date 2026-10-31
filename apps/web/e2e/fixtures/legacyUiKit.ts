import { test as base, expect } from "@playwright/test";

/** Force Classic UI so M-059 / smoke / parity specs match legacy selectors. */
export const test = base.extend({
  context: async ({ context }, runFixture) => {
    await context.addInitScript(() => {
      localStorage.setItem(
        "chessschool.settings",
        JSON.stringify({ state: { uiKit: "legacy" }, version: 12 }),
      );
    });
    await runFixture(context);
  },
});

export { expect };
