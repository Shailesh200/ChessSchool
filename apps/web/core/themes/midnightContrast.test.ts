import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "../..");

/** WCAG 2.x contrast ratio for two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = hex.replace("#", "");
    const ch = [0, 2, 4].map((i) => {
      const c = parseInt(n.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * ch[0]! + 0.7152 * ch[1]! + 0.0722 * ch[2]!;
  };
  const hi = Math.max(lum(a), lum(b));
  const lo = Math.min(lum(a), lum(b));
  return (hi + 0.05) / (lo + 0.05);
}

function selectorBlock(css: string, selector: string): string {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`missing selector ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  return css.slice(open + 1, close);
}

function decls(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const clean = block.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const part of clean.split(";")) {
    const idx = part.indexOf(":");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name.startsWith("--")) out[name] = value;
  }
  return out;
}

function resolve(props: Record<string, string>, name: string): string {
  let value = props[name];
  if (!value) throw new Error(`missing ${name}`);
  const ref = value.match(/^var\((--[\w-]+)\)$/);
  if (ref) value = props[ref[1]!] ?? value;
  const hex = value.match(/#[0-9a-fA-F]{6}/);
  if (!hex) throw new Error(`${name} is not a hex colour: ${value}`);
  return hex[0]!;
}

describe("midnight /play contrast", () => {
  it("legacy midnight link colour is at least 4.5:1 on midnight surfaces", () => {
    const css = readFileSync(join(ROOT, "app/globals.css"), "utf8");
    const tokens = readFileSync(join(ROOT, "app/premium/kit-tokens.css"), "utf8");
    const light = decls(selectorBlock(tokens, ':root,[data-theme="light"]'));
    const midnight = decls(
      selectorBlock(css, 'html[data-ui-kit="legacy"][data-app-theme="midnight"]'),
    );
    const props = { ...light, ...midnight };
    const link = resolve(props, "--cs-text-link");
    const surface = resolve(props, "--surface");
    const card = resolve(props, "--surface-card");
    const brand50 = css.match(
      /html\[data-app-theme="midnight"\]\s*\{\s*--brand-50:\s*(#[0-9a-fA-F]{6})/,
    )?.[1];
    expect(brand50?.toLowerCase()).toBe("#2a2f57");
    expect(contrast(link, surface)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(link, card)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(link, brand50!)).toBeGreaterThanOrEqual(4.5);
  });

  it("premium dark on-brand text is at least 4.5:1 on the dark brand", () => {
    const tokens = readFileSync(join(ROOT, "app/premium/kit-tokens.css"), "utf8");
    const dark = decls(selectorBlock(tokens, '[data-theme="dark"]'));
    const fg = resolve(dark, "--cs-text-on-brand");
    const bg = resolve(dark, "--cs-brand");
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });

  it("the review count badge uses on-brand text instead of white", () => {
    const css = readFileSync(join(ROOT, "app/premium/illustrated-screens.css"), "utf8");
    const badge = selectorBlock(css, ".nav-due");
    expect(badge).toContain("color: var(--cs-text-on-brand)");
    expect(badge.toLowerCase()).not.toContain("#fff");
  });
});
