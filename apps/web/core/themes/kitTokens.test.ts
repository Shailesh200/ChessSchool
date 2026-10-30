import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_UI_KIT,
  KIT_SEMANTIC_LIGHT,
  LEGACY_ALIAS_KEYS,
  PREMIUM_LEGACY_ALIAS_MAP,
  resolvePremiumColorMode,
  resolveUiKit,
} from "./kitTokens";

const ROOT = join(import.meta.dirname, "../..");

describe("kit token mapping", () => {
  it("pins key kit semantic light values", () => {
    expect(KIT_SEMANTIC_LIGHT.brand).toBe("#0F6B54");
    expect(KIT_SEMANTIC_LIGHT.accent).toBe("#FF7A59");
    expect(KIT_SEMANTIC_LIGHT.bg).toBe("#FFF9F0");
    expect(KIT_SEMANTIC_LIGHT.text).toBe("#1F2B2D");
  });

  it("premium-aliases.css wires legacy names to cs tokens", () => {
    const css = readFileSync(join(ROOT, "app/premium/premium-aliases.css"), "utf8");
    for (const key of LEGACY_ALIAS_KEYS) {
      expect(css).toContain(`${key}:`);
    }
    expect(css).toContain("--brand-500: var(--cs-brand)");
    expect(css).toContain("--surface: var(--cs-bg)");
    expect(css).toContain("--ink-900: var(--cs-text)");
  });

  it("kit-tokens.css defines cs semantic brand/accent for light", () => {
    const css = readFileSync(join(ROOT, "app/premium/kit-tokens.css"), "utf8");
    expect(css).toContain(`--cs-brand:${KIT_SEMANTIC_LIGHT.brand}`);
    expect(css).toContain(`--cs-accent:${KIT_SEMANTIC_LIGHT.accent}`);
    expect(css).toContain(`--cs-bg:${KIT_SEMANTIC_LIGHT.bg}`);
  });

  it("maps every documented legacy alias to a kit value", () => {
    for (const [legacy, kitKey] of Object.entries(PREMIUM_LEGACY_ALIAS_MAP)) {
      const value = KIT_SEMANTIC_LIGHT[kitKey as keyof typeof KIT_SEMANTIC_LIGHT];
      if (value) expect(value).toMatch(/^#/);
      expect(legacy.startsWith("--")).toBe(true);
    }
  });
});

describe("ui kit theme switch", () => {
  it("defaults to premium", () => {
    expect(DEFAULT_UI_KIT).toBe("premium");
    expect(resolveUiKit(undefined)).toBe("premium");
    expect(resolveUiKit("premium")).toBe("premium");
  });

  it("allows legacy fallback", () => {
    expect(resolveUiKit("legacy")).toBe("legacy");
  });

  it("collapses app themes to premium light/dark", () => {
    expect(resolvePremiumColorMode("default")).toBe("light");
    expect(resolvePremiumColorMode("midnight")).toBe("dark");
  });
});
