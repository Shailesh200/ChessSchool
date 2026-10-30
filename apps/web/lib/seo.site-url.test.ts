import { describe, expect, it } from "vitest";
import {
  isProductionSiteUrl,
  metadataRobots,
  resolveSiteUrlFromInput,
  robotsRouteForSite,
  socialMetaForSite,
} from "./seo";

const TEST_HOST = "https://chess-school-test.vercel.app";
const PROD = "https://chess-school.in";

function headers(host: string, proto = "https"): Headers {
  return new Headers({ host, "x-forwarded-host": host, "x-forwarded-proto": proto });
}

describe("resolveSiteUrlFromInput (QA-N2-001)", () => {
  it("prefers NEXT_PUBLIC_SITE_URL when set", () => {
    expect(
      resolveSiteUrlFromInput(
        { NEXT_PUBLIC_SITE_URL: TEST_HOST, VERCEL_URL: "ignored.vercel.app" },
        headers("ignored.local"),
      ),
    ).toBe(TEST_HOST);
  });

  it("uses request host when env is unset", () => {
    expect(resolveSiteUrlFromInput({}, headers("chess-school-test.vercel.app"))).toBe(TEST_HOST);
  });

  it("falls back to VERCEL_URL then localhost", () => {
    expect(resolveSiteUrlFromInput({ VERCEL_URL: "preview-abc.vercel.app" }, null)).toBe(
      "https://preview-abc.vercel.app",
    );
    expect(resolveSiteUrlFromInput({}, null)).toBe("http://localhost:3000");
  });

  it("never hardcodes chess-school.in as a fallback", () => {
    expect(resolveSiteUrlFromInput({}, null)).not.toContain("chess-school.in");
    expect(resolveSiteUrlFromInput({ VERCEL_URL: "x.vercel.app" }, null)).not.toContain(
      "chess-school.in",
    );
  });
});

describe("isProductionSiteUrl", () => {
  it("is true only for chess-school.in hostnames", () => {
    expect(isProductionSiteUrl(PROD)).toBe(true);
    expect(isProductionSiteUrl("https://www.chess-school.in/path")).toBe(true);
    expect(isProductionSiteUrl(TEST_HOST)).toBe(false);
  });

  it("treats chess-school-test as non-prod even with VERCEL_ENV=production", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    try {
      expect(
        isProductionSiteUrl(
          resolveSiteUrlFromInput({ NEXT_PUBLIC_SITE_URL: TEST_HOST }, null),
        ),
      ).toBe(false);
    } finally {
      process.env.VERCEL_ENV = prev;
    }
  });
});

describe("socialMetaForSite", () => {
  const opts = {
    title: "Test",
    description: "Desc",
    path: "/academy",
    kind: "home" as const,
  };

  it("uses the test host and noindex when not production", () => {
    const meta = socialMetaForSite(TEST_HOST, opts);
    expect(meta.alternates?.canonical).toBe(`${TEST_HOST}/academy`);
    expect(meta.openGraph?.url).toBe(`${TEST_HOST}/academy`);
    const image = meta.openGraph?.images?.[0];
    expect(typeof image === "object" && image && "url" in image ? image.url : image).toContain(
      `${TEST_HOST}/api/og`,
    );
    expect(JSON.stringify(meta)).not.toContain("chess-school.in");
    expect(metadataRobots(false)).toEqual(meta.robots);
  });

  it("keeps indexable prod metadata for chess-school.in", () => {
    const meta = socialMetaForSite(PROD, opts);
    expect(meta.alternates?.canonical).toBe(`${PROD}/academy`);
    expect(meta.robots).toEqual(metadataRobots(true));
  });
});

describe("robotsRouteForSite", () => {
  it("disallows all crawling off production", () => {
    const route = robotsRouteForSite(TEST_HOST);
    expect(route.rules.disallow).toBe("/");
    expect(route.sitemap).toBeUndefined();
  });

  it("keeps production robots rules and sitemap on chess-school.in", () => {
    const route = robotsRouteForSite(PROD);
    expect(route.rules.allow).toBe("/");
    expect(route.rules.disallow).toEqual(["/admin", "/api/"]);
    expect(route.sitemap).toBe(`${PROD}/sitemap.xml`);
  });
});

describe("sitemap locs", () => {
  it("use the resolved origin, not chess-school.in, on preview hosts", () => {
    const origin = resolveSiteUrlFromInput({}, headers("chess-school-test.vercel.app"));
    const sample = [`${origin}`, `${origin}/academy`, `${origin}/lesson/demo`];
    for (const url of sample) {
      expect(url.startsWith(TEST_HOST)).toBe(true);
      expect(url).not.toContain("chess-school.in");
    }
  });

  it("uses NEXT_PUBLIC_SITE_URL for sitemap locs when configured", () => {
    const origin = resolveSiteUrlFromInput({ NEXT_PUBLIC_SITE_URL: TEST_HOST }, null);
    expect(`${origin}/sitemap.xml`).toBe(`${TEST_HOST}/sitemap.xml`);
  });
});
