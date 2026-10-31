import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEME_BOOTSTRAP_SCRIPT } from "@/core/bootstrap/themeBootstrapScript";

const ROOT = join(import.meta.dirname, "../..");

/** Foreground/background pairs the /plan screen paints (IS-073 / DP-W-011). */
const PLAN_PAIRS = [
  {
    name: "selected pace",
    fg: "--cs-text-on-brand",
    bg: "--cs-brand",
  },
  {
    name: "streak chip",
    fg: "--cs-accent-soft-text",
    bg: "--cs-accent-soft",
  },
  {
    name: "finished homework mark",
    fg: "--cs-text-on-brand",
    bg: "--cs-success",
  },
] as const;

function blockVars(css: string, marker: string): Record<string, string> {
  const start = css.lastIndexOf(marker);
  if (start < 0) throw new Error(`missing ${marker}`);
  const open = css.indexOf("{", start);
  let depth = 0;
  let end = open;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}") {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }
  const body = css.slice(open + 1, end);
  const out: Record<string, string> = {};
  for (const match of body.matchAll(/(--[\w-]+):\s*([^;]+);/g)) {
    out[match[1]!] = match[2]!.trim();
  }
  return out;
}

function channel(hex: string): [number, number, number] {
  const n = Number.parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrast(fg: string, bg: string): number {
  const a = luminance(channel(fg));
  const b = luminance(channel(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

describe("/plan token contrast", () => {
  const tokens = readFileSync(join(ROOT, "app/premium/kit-tokens.css"), "utf8");
  const light = blockVars(tokens, ':root,[data-theme="light"]');
  const dark = blockVars(tokens, '[data-theme="dark"]');
  const plan = readFileSync(join(ROOT, "components/plan/PlanClient.tsx"), "utf8");
  const css = readFileSync(join(ROOT, "app/premium/premium-components.css"), "utf8");

  it("keeps pace, streak, and homework mark at least 4.5:1 in light and midnight", () => {
    for (const mode of [
      ["light", light],
      ["midnight", dark],
    ] as const) {
      const [name, vars] = mode;
      for (const pair of PLAN_PAIRS) {
        const fg = vars[pair.fg];
        const bg = vars[pair.bg];
        expect(fg, `${name} ${pair.fg}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        expect(bg, `${name} ${pair.bg}`).toMatch(/^#[0-9A-Fa-f]{6}$/);
        const ratio = contrast(fg!, bg!);
        expect(ratio, `${name} ${pair.name} ${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it("paints those pairs with theme tokens, not white-on-brand or accent-edge on a tint", () => {
    expect(plan).toContain("cs-fill-brand");
    expect(plan).toContain("cs-accent-note");
    expect(plan).toContain("cs-fill-success");
    expect(plan).not.toContain("bg-brand text-white");
    expect(plan).not.toContain("text-accent-600");
    expect(plan).toContain('label="Daily goal progress"');
    expect(css).toContain("background: var(--cs-brand)");
    expect(css).toContain("color: var(--cs-text-on-brand)");
    expect(css).toContain("background: var(--cs-accent-soft)");
    expect(css).toContain("color: var(--cs-accent-soft-text)");
    expect(css).toContain("background: var(--cs-success)");
  });
});

describe("midnight theme bootstrap", () => {
  it("applies the dark token set when persisted appTheme is midnight", () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { appTheme: "midnight", uiKit: "premium" },
        version: 12,
      }),
    );
    document.documentElement.removeAttribute("data-theme");
    new Function(THEME_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(document.documentElement.dataset.appTheme).toBe("midnight");
  });

  it("keeps light mode when the persisted theme is not midnight", () => {
    localStorage.setItem(
      "chessschool.settings",
      JSON.stringify({
        state: { appTheme: "default", uiKit: "premium" },
        version: 12,
      }),
    );
    new Function(THEME_BOOTSTRAP_SCRIPT)();
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});
