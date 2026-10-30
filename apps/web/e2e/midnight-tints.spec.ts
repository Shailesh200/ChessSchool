import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test, expect } from "./fixtures/legacyUiKit";
import type { Page } from "@playwright/test";

/**
 * UI-W-001: midnight's dark --brand-50/--brand-100 tints must win over every
 * school theme (same specificity, so source order decides), and text on those
 * tints must stay readable (WCAG AA 4.5:1).
 */
const SCHOOLS = ["elementary", "highschool", "university", "graduation"] as const;
const MIDNIGHT_BRAND_50 = "#2a2f57";
const MIDNIGHT_BRAND_100 = "#343c6e";

type Probe = {
  brand50: string;
  brand100: string;
  samples: { name: string; tint: "50" | "100"; fg: string; bg: string }[];
};

async function probe(page: Page, school: string): Promise<Probe> {
  await page.addInitScript((sc) => {
    const key = "chessschool.settings";
    const cur = JSON.parse(localStorage.getItem(key) || "{}");
    const state = Object.assign(cur.state || {}, {
      appTheme: "midnight",
      schoolTheme: sc,
    });
    localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
  }, school);
  await page.goto("/themes");
  await page.waitForFunction(
    () => document.documentElement.dataset.appTheme === "midnight",
  );
  return page.evaluate(() => {
    const root = document.documentElement;
    const cs = getComputedStyle(root);
    const host = document.createElement("div");
    host.style.cssText = "position:fixed;left:0;top:0;opacity:0;pointer-events:none";
    const specs: [string, "50" | "100", string][] = [
      ["text-ink", "50", "text-ink bg-brand-50"],
      ["text-ink-700", "50", "text-ink-700 bg-brand-50"],
      ["text-ink-500", "50", "text-ink-500 bg-brand-50"],
      ["text-ink-300", "50", "text-ink-300 bg-brand-50"],
      ["text-brand", "50", "text-brand bg-brand-50"],
      ["text-ink", "100", "text-ink bg-brand-100"],
      ["text-ink-700", "100", "text-ink-700 bg-brand-100"],
      ["text-ink-500", "100", "text-ink-500 bg-brand-100"],
      ["text-ink-300", "100", "text-ink-300 bg-brand-100"],
      ["text-brand", "100", "text-brand bg-brand-100"],
    ];
    const els = specs.map(([, , cls]) => {
      const el = document.createElement("span");
      el.className = cls;
      el.textContent = "Aa";
      host.appendChild(el);
      return el;
    });
    document.body.appendChild(host);
    const samples = specs.map(([name, tint], i) => {
      const s = getComputedStyle(els[i]!);
      return { name, tint, fg: s.color, bg: s.backgroundColor };
    });
    host.remove();
    return {
      brand50: cs.getPropertyValue("--brand-50").trim(),
      brand100: cs.getPropertyValue("--brand-100").trim(),
      samples,
    };
  });
}

function channels(css: string): [number, number, number] {
  // color-mix() computes to `color(srgb r g b)` with 0..1 channels.
  const srgb = css.match(/^color\(srgb ([\d.]+) ([\d.]+) ([\d.]+)/);
  if (srgb) return [+srgb[1]! * 255, +srgb[2]! * 255, +srgb[3]! * 255];
  const m = css.match(/rgba?\(([^)]+)\)/);
  if (!m) throw new Error(`unparseable colour: ${css}`);
  const p = m[1]!
    .split(/[ ,/]+/)
    .filter(Boolean)
    .map(Number);
  return [p[0]!, p[1]!, p[2]!];
}
function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}
function contrast(fg: string, bg: string): number {
  const a = luminance(channels(fg));
  const b = luminance(channels(bg));
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

for (const school of SCHOOLS) {
  test(`midnight + ${school}: dark brand tints win and text on them is >= 4.5:1`, async ({
    page,
  }) => {
    const result = await probe(page, school);
    expect(result.brand50).toBe(MIDNIGHT_BRAND_50);
    expect(result.brand100).toBe(MIDNIGHT_BRAND_100);
    for (const s of result.samples) {
      const ratio = contrast(s.fg, s.bg);
      expect(
        ratio,
        `${s.name} on brand-${s.tint} (${s.fg} on ${s.bg}) = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("classic: --ink-300 labels keep >= 3:1 on the page and sunken surfaces (UI-W-015)", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const key = "chessschool.settings";
    const cur = JSON.parse(localStorage.getItem(key) || "{}");
    const state = Object.assign(cur.state || {}, {
      appTheme: "default",
      schoolTheme: "university",
    });
    localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
  });
  await page.goto("/themes");
  const v = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const get = (n: string) => cs.getPropertyValue(n).trim();
    return {
      ink: get("--ink-300"),
      surface: get("--surface"),
      sunken: get("--surface-sunken"),
      card: get("--surface-card"),
    };
  });
  const rgb = (hex: string) => {
    const h =
      hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
    return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
  };
  for (const bg of [v.surface, v.sunken, v.card]) {
    const ratio = contrast(rgb(v.ink), rgb(bg));
    expect(
      ratio,
      `ink-300 ${v.ink} on ${bg} = ${ratio.toFixed(2)}`,
    ).toBeGreaterThanOrEqual(3);
  }
});

for (const school of SCHOOLS) {
  test(`midnight + ${school}: /academy semester badge text is >= 4.5:1`, async ({
    page,
  }) => {
    await page.addInitScript((sc) => {
      const key = "chessschool.settings";
      const cur = JSON.parse(localStorage.getItem(key) || "{}");
      const state = Object.assign(cur.state || {}, {
        appTheme: "midnight",
        schoolTheme: sc,
      });
      localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
    }, school);
    await page.goto("/academy");
    await page.waitForFunction(
      () => document.documentElement.dataset.appTheme === "midnight",
    );
    await page.locator(".school-semester-badge").first().waitFor();
    const badges = await page.locator(".school-semester-badge").evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { text: el.textContent ?? "", fg: s.color, bg: s.backgroundColor };
      }),
    );
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) {
      const ratio = contrast(b.fg, b.bg);
      expect(
        ratio,
        `semester badge "${b.text}" (${b.fg} on ${b.bg}) = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

/**
 * UI-W-015 (light themes): --ink-300 is the quiet UI colour (icons, disabled
 * glyphs): >= 3:1 on every surface of every light app theme (royal's sunken
 * surface was 2.91). Real text uses --ink-500 (>= 4.5:1 on the page, card and sunken
 * surfaces; it was 4.07 on royal's sunken surface).
 */
const LIGHT_THEMES = ["default", "blue", "forest", "ivory", "royal"] as const;

for (const appTheme of LIGHT_THEMES) {
  test(`${appTheme}: --ink-300 is >= 3:1 on every surface, --ink-500 text is >= 4.5:1 on page, card and sunken`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      const key = "chessschool.settings";
      const cur = JSON.parse(localStorage.getItem(key) || "{}");
      const state = Object.assign(cur.state || {}, {
        appTheme: theme,
        schoolTheme: "university",
      });
      localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
    }, appTheme);
    await page.goto("/themes");
    await page.waitForFunction(
      (theme) => document.documentElement.dataset.appTheme === theme,
      appTheme,
    );
    const v = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const get = (n: string) => cs.getPropertyValue(n).trim();
      return {
        ink300: get("--ink-300"),
        ink500: get("--ink-500"),
        surface: get("--surface"),
        card: get("--surface-card"),
        sunken: get("--surface-sunken"),
      };
    });
    const rgb = (hex: string) => {
      const h =
        hex.length === 4 ? [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(1);
      return `rgb(${[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(", ")})`;
    };
    for (const bg of [v.surface, v.card, v.sunken]) {
      const ratio = contrast(rgb(v.ink300), rgb(bg));
      expect(
        ratio,
        `${appTheme}: ink-300 ${v.ink300} on ${bg} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(3);
    }
    for (const bg of [v.surface, v.card, v.sunken]) {
      const ratio = contrast(rgb(v.ink500), rgb(bg));
      expect(
        ratio,
        `${appTheme}: ink-500 ${v.ink500} on ${bg} = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

test("text-ink-300 is only used on icon glyphs, never on text (UI-W-015)", () => {
  const root = path.resolve(__dirname, "..");
  const hits: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === "node_modules" || name === ".next" || name === "e2e") continue;
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.tsx$/.test(name)) {
        readFileSync(full, "utf8")
          .split("\n")
          .forEach((line, i) => {
            if (/text-ink-300/.test(line))
              hits.push(`${path.relative(root, full)}:${i + 1}: ${line.trim()}`);
          });
      }
    }
  };
  for (const d of ["app", "components", "features"]) walk(path.join(root, d));
  // Icon-only: the journal and admin delete buttons and the locked-lesson glyph.
  const textUses = hits.filter(
    (h) =>
      !/<Icon /.test(h) &&
      !/h-[78] w-[78] items-center justify-center rounded-full/.test(h),
  );
  expect(textUses, `text-ink-300 on text: ${textUses.join("\n")}`).toEqual([]);
});

for (const appTheme of LIGHT_THEMES) {
  test(`${appTheme}: /academy semester badge text is >= 4.5:1 (UI-W-015)`, async ({
    page,
  }) => {
    await page.addInitScript((theme) => {
      const key = "chessschool.settings";
      const cur = JSON.parse(localStorage.getItem(key) || "{}");
      const state = Object.assign(cur.state || {}, {
        appTheme: theme,
        schoolTheme: "university",
      });
      localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
    }, appTheme);
    await page.goto("/academy");
    await page.waitForFunction(
      (theme) => document.documentElement.dataset.appTheme === theme,
      appTheme,
    );
    await page.locator(".school-semester-badge").first().waitFor();
    const badges = await page.locator(".school-semester-badge").evaluateAll((els) =>
      els.map((el) => {
        const s = getComputedStyle(el);
        return { text: el.textContent ?? "", fg: s.color, bg: s.backgroundColor };
      }),
    );
    expect(badges.length).toBeGreaterThan(0);
    for (const b of badges) {
      const ratio = contrast(b.fg, b.bg);
      expect(
        ratio,
        `${appTheme}: semester badge "${b.text}" (${b.fg} on ${b.bg}) = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}

/**
 * UI-W-IB1 (IconBadge contrast; local ID, not in COMBINED.md, where UI-W-016 is
 * something else): IconBadge tiles paint a white gradient stop (via-white). In
 * midnight the glyph must stay >= 4.5:1 on the LIGHTEST gradient stop of its tile, for
 * every tone, on every school theme, whatever surface the tile sits on.
 */
const ICON_TONES: Record<string, [string, string]> = {
  brand: [
    "border-brand-100/90 bg-gradient-to-br from-brand-50 via-white to-brand-50/40 text-brand",
    "text-brand",
  ],
  gold: [
    "border-gold/35 bg-gradient-to-br from-gold/25 via-white to-gold/10 text-gold",
    "text-gold",
  ],
  accent: [
    "border-accent-400/30 bg-gradient-to-br from-accent-400/15 via-white to-accent-400/5 text-accent-600",
    "text-accent-600",
  ],
  success: [
    "border-success/30 bg-gradient-to-br from-success/15 via-white to-success/5 text-success-600",
    "text-success-600",
  ],
  violet: [
    "border-brand-300/40 bg-gradient-to-br from-brand-100/80 via-white to-brand-50/30 text-brand-700",
    "text-brand-700",
  ],
};

for (const school of SCHOOLS) {
  test(`midnight + ${school}: IconBadge glyphs are >= 4.5:1 on the lightest gradient stop`, async ({
    page,
  }) => {
    await page.addInitScript((sc) => {
      const key = "chessschool.settings";
      const cur = JSON.parse(localStorage.getItem(key) || "{}");
      const state = Object.assign(cur.state || {}, {
        appTheme: "midnight",
        schoolTheme: sc,
      });
      localStorage.setItem(key, JSON.stringify({ state, version: cur.version || 11 }));
    }, school);
    await page.goto("/themes");
    await page.waitForFunction(
      () => document.documentElement.dataset.appTheme === "midnight",
    );
    const tiles = await page.evaluate((tones) => {
      const cx = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      })!;
      const rgba = (c: string): number[] => {
        cx.clearRect(0, 0, 1, 1);
        cx.fillStyle = "#000";
        cx.fillStyle = c;
        cx.fillRect(0, 0, 1, 1);
        const d = cx.getImageData(0, 0, 1, 1).data;
        return [d[0]!, d[1]!, d[2]!, d[3]! / 255];
      };
      const over = (t: number[], b: number[]) =>
        [0, 1, 2].map((i) => t[i]! * t[3]! + b[i]! * (1 - t[3]!));
      const lum = (c: number[]) => {
        const f = (v: number) => {
          const s = v / 255;
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        };
        return 0.2126 * f(c[0]!) + 0.7152 * f(c[1]!) + 0.0722 * f(c[2]!);
      };
      // Sit the tiles on the sunken surface, the lightest midnight surface.
      const host = document.createElement("div");
      host.style.cssText =
        "position:fixed;left:0;top:0;opacity:0;pointer-events:none;background:var(--surface-sunken)";
      document.body.appendChild(host);
      const out = Object.entries(tones).map(([tone, [shell, icon]]) => {
        const el = document.createElement("span");
        el.className = `relative inline-flex rounded-2xl border before:absolute before:inset-px before:bg-gradient-to-b before:from-white/50 before:to-transparent before:opacity-60 ${shell}`;
        el.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" stroke="currentColor" class="${icon}"><path d="M4 4h16"/></svg>`;
        host.appendChild(el);
        const cs = getComputedStyle(el);
        const bg = rgba(cs.backgroundColor);
        const behind = bg[3]! > 0 ? over(bg, [38, 41, 71, 1]) : [38, 41, 71];
        const stops = [
          "--tw-gradient-from",
          "--tw-gradient-via",
          "--tw-gradient-to",
        ].map((v) => over(rgba(cs.getPropertyValue(v).trim()), behind));
        const lightest = stops.reduce((a, b) => (lum(a) >= lum(b) ? a : b));
        // worst case of the white sheen (::before from-white/50 at its opacity)
        const sheen = 0.5 * Number(getComputedStyle(el, "::before").opacity);
        const shown = over([255, 255, 255, sheen], lightest);
        const glyph = getComputedStyle(el.querySelector("svg")!).color;
        return { tone, glyph, lightest: shown.map(Math.round), stops };
      });
      host.remove();
      return out;
    }, ICON_TONES);
    expect(tiles.length).toBe(Object.keys(ICON_TONES).length);
    for (const t of tiles) {
      const ratio = contrast(t.glyph, `rgb(${t.lightest.join(",")})`);
      expect(
        ratio,
        `${t.tone} IconBadge glyph ${t.glyph} on lightest stop rgb(${t.lightest.join(",")}) = ${ratio.toFixed(2)}`,
      ).toBeGreaterThanOrEqual(4.5);
    }
  });
}
