/** @vitest-environment jsdom */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PremiumOnboardingWizard } from "./PremiumOnboardingWizard";
import { useSettings } from "@/core/store/settings.store";
import { resetRehydrateReadyForTests } from "@/core/hooks/useRehydrateReady";
import { applyDocumentSettings } from "@/core/bootstrap/storeBootstrap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const DARK_BG = "#17302B";
const DARK_TEXT = "#FFF9F0";

describe("onboarding midnight tokens", () => {
  beforeEach(() => {
    resetRehydrateReadyForTests();
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    useSettings.setState({ appTheme: "default", uiKit: "premium" });
  });

  it("renders the dark token set when persisted appTheme is midnight", () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { appTheme: "midnight", uiKit: "premium" },
        version: 12,
      }),
    );
    render(<PremiumOnboardingWizard name="Ada" />);
    const step = screen.getByRole("heading", { name: "What brings you here?" }).closest("section");
    expect(step).toHaveAttribute("data-theme", "dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.style.colorScheme).toBe("dark");

    const tokens = readFileSync(
      join(import.meta.dirname, "../../../app/premium/kit-tokens.css"),
      "utf8",
    );
    const dark = tokens.slice(tokens.lastIndexOf('[data-theme="dark"]'));
    expect(dark).toContain(`--cs-bg:${DARK_BG}`);
    expect(dark).toContain(`--cs-text:${DARK_TEXT}`);
    expect(dark).not.toContain("--cs-bg:#FFF9F0");
  });

  it("does not let default settings paint cream over a bootstrapped midnight theme", () => {
    document.documentElement.dataset.theme = "dark";
    applyDocumentSettings({
      colorblind: "none",
      reducedMotion: false,
      textScale: 1,
      highContrast: false,
      boardTheme: "classic",
      schoolTheme: "university",
      appTheme: "default",
      uiKit: "premium",
    });
    expect(document.documentElement.dataset.theme).toBe("dark");
  });
});
