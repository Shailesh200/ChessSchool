import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ANALYTICS_SWITCH_HINT,
  ANALYTICS_SWITCH_LABEL,
  PRIVACY_CRASH_REPORTS,
  PRIVACY_OFF_UNTIL_ON,
} from "./copy";

// The words for the one analytics-and-performance switch (also used in the store privacy forms),
// and the pins that keep Sentry on the diagnostics side: no default PII, no user email or name.

const web = process.cwd(); // vitest runs from apps/web
const mobile = join(web, "..", "mobile");
const read = (...p: string[]) => readFileSync(join(...p), "utf8");

describe("copy: one switch, off until you turn it on", () => {
  it("the words are the approved ones", () => {
    expect(ANALYTICS_SWITCH_LABEL).toBe("Share analytics & performance");
    expect(ANALYTICS_SWITCH_HINT).toBe(
      "Off until you turn it on. One switch for usage analytics and performance sharing.",
    );
    expect(PRIVACY_OFF_UNTIL_ON).toBe(
      "Analytics and performance sharing are off until you turn them on in Settings, with one switch for both. Nothing is collected, and the Vercel scripts are not loaded, until you do.",
    );
    expect(PRIVACY_CRASH_REPORTS).toBe(
      "Crash reports are collected for diagnostics without personal info. They are not part of the switch: only analytics and performance are opt-in.",
    );
  });

  it("the web settings page and the privacy page use them (and say nothing else about it)", () => {
    const settings = read(web, "app/settings/page.tsx");
    expect(settings).toContain(
      "<Row label={ANALYTICS_SWITCH_LABEL} hint={ANALYTICS_SWITCH_HINT}>",
    );
    expect(settings).not.toContain("Share usage analytics");
    const privacy = read(web, "app/privacy/page.tsx");
    expect(privacy).toContain("{PRIVACY_OFF_UNTIL_ON}");
    expect(privacy).toContain("{PRIVACY_CRASH_REPORTS}");
    expect(privacy).not.toContain("You can turn off");
    expect(privacy).not.toContain("when you opt in");
  });

  it("the app's settings use the same words as the web", () => {
    const m = read(mobile, "src/productAnalytics/copy.ts");
    expect(m).toContain(
      `ANALYTICS_SWITCH_LABEL = ${JSON.stringify(ANALYTICS_SWITCH_LABEL)}`,
    );
    expect(m).toContain(JSON.stringify(ANALYTICS_SWITCH_HINT));
    const screen = read(mobile, "app/settings.tsx");
    expect(screen).toContain("{ANALYTICS_SWITCH_LABEL}");
    expect(screen).toContain("{ANALYTICS_SWITCH_HINT}");
    expect(screen).not.toContain("Share usage analytics");
    expect(screen).not.toContain("No ads.");
  });
});

describe("Sentry is diagnostics: no default PII, no user email or name", () => {
  const configs = [
    join(mobile, "src/sentry.ts"),
    join(web, "instrumentation-client.ts"),
    join(web, "sentry.server.config.ts"),
    join(web, "sentry.edge.config.ts"),
  ];

  it("sendDefaultPii is false in all four Sentry configs", () => {
    for (const f of configs) {
      const src = readFileSync(f, "utf8");
      expect(src, f).toMatch(/sendDefaultPii:\s*false/);
      expect(src, f).not.toMatch(/sendDefaultPii:\s*true/);
    }
  });

  const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((n) => {
      if (["node_modules", ".next", "coverage", "dist", "ios", "android"].includes(n))
        return [];
      const p = join(dir, n);
      if (statSync(p).isDirectory()) return sources(p);
      return /\.(ts|tsx)$/.test(n) && !/\.test\./.test(n) ? [p] : [];
    });

  it("no Sentry setUser call carries an email, name, username or IP", () => {
    const calls: string[] = [];
    for (const f of [
      ...sources(web),
      ...sources(join(mobile, "src")),
      ...sources(join(mobile, "app")),
    ]) {
      const src = readFileSync(f, "utf8");
      const sentryFile = /@sentry\//.test(src);
      const re = sentryFile ? /\bsetUser\s*\(/g : /\.setUser\s*\(/g;
      for (let m = re.exec(src); m; m = re.exec(src)) {
        let depth = 0;
        let i = src.indexOf("(", m.index);
        const start = i;
        for (; i < src.length; i++) {
          if (src[i] === "(") depth++;
          if (src[i] === ")" && --depth === 0) break;
        }
        calls.push(src.slice(start, i + 1));
      }
    }
    for (const args of calls) {
      expect(args).not.toMatch(/\b(email|name|username|ip_address)\b/i);
    }
  });
});
