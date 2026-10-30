import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const WEB = path.join(import.meta.dirname, "..");

const ROUTES: { page: string; h1Source?: string }[] = [
  { page: "app/about/page.tsx" },
  { page: "app/privacy/page.tsx" },
  { page: "app/terms/page.tsx" },
  { page: "app/support/page.tsx" },
  { page: "app/offline/page.tsx" },
  { page: "app/onboarding/page.tsx", h1Source: "components/onboarding/OnboardingWizard.tsx" },
  { page: "app/placement/page.tsx", h1Source: "features/placement/PlacementTest.tsx" },
];

describe("static route landmarks (DP-W-012)", () => {
  it("wraps each standalone route in a main landmark with a page h1", () => {
    for (const { page, h1Source } of ROUTES) {
      const src = fs.readFileSync(path.join(WEB, page), "utf8");
      expect(src, page).toMatch(/<main[\s>]/);
      const h1Src = h1Source
        ? fs.readFileSync(path.join(WEB, h1Source), "utf8")
        : src;
      expect(h1Src, page).toMatch(/<h1[\s>]/);
    }
  });
});
