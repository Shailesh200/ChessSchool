import type { Metadata } from "next";
import { headers } from "next/headers";

export const siteName = "ChessSchool";

/** Hostnames that may be indexed and use production robots.txt rules. */
export const PRODUCTION_SITE_HOSTS = new Set(["chess-school.in", "www.chess-school.in"]);

export type SiteUrlEnv = {
  NEXT_PUBLIC_SITE_URL?: string;
  VERCEL_URL?: string;
};

export type HeaderLike = { get(name: string): string | null | undefined };

function trimOrigin(url: string): string {
  const u = new URL(url.includes("://") ? url : `https://${url}`);
  u.hash = "";
  u.search = "";
  u.pathname = "";
  return u.origin;
}

/** Resolve the public site origin (no path). Never falls back to chess-school.in. */
export function resolveSiteUrlFromInput(
  env: SiteUrlEnv,
  requestHeaders?: HeaderLike | null,
): string {
  const configured = env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured) return trimOrigin(configured);

  if (requestHeaders) {
    const rawHost =
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
    const host = rawHost?.split(",")[0]?.trim();
    if (host) {
      const proto =
        requestHeaders.get("x-forwarded-proto")?.split(",")[0]?.trim() ?? "https";
      return trimOrigin(`${proto}://${host}`);
    }
  }

  const vercel = env.VERCEL_URL?.trim();
  if (vercel) return trimOrigin(`https://${vercel}`);

  return "http://localhost:3000";
}

export function hostnameFromSiteUrl(siteUrl: string): string {
  return new URL(siteUrl).hostname.toLowerCase();
}

/** Indexable production site — hostname only, not VERCEL_ENV. */
export function isProductionSiteUrl(siteUrl: string): boolean {
  return PRODUCTION_SITE_HOSTS.has(hostnameFromSiteUrl(siteUrl));
}

export async function resolveSiteUrl(): Promise<string> {
  const h = await headers();
  return resolveSiteUrlFromInput(
    {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      VERCEL_URL: process.env.VERCEL_URL,
    },
    h,
  );
}

export function metadataRobots(isProduction: boolean): NonNullable<Metadata["robots"]> {
  if (isProduction) {
    return { index: true, follow: true, googleBot: { index: true, follow: true } };
  }
  return { index: false, follow: false, googleBot: { index: false, follow: false } };
}

export function canonicalForSite(siteUrl: string, path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${trimOrigin(siteUrl)}${p}`;
}

/** @deprecated Use canonicalForSite(await resolveSiteUrl(), path) in server code. */
export function canonical(path: string): string {
  return canonicalForSite(
    resolveSiteUrlFromInput(
      {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      },
      null,
    ),
    path,
  );
}

export function lessonDescription(title: string, subtitle?: string | null): string {
  const sub = subtitle?.trim();
  return sub
    ? `${title} — ${sub}. Interactive chess lesson with coach narration at ChessSchool.`
    : `Play the ${title} lesson — puzzles, coach tips, and FEN-verified positions at ChessSchool.`;
}

export function classDescription(title: string, blurb?: string | null): string {
  const b = blurb?.trim();
  return b
    ? `${title}: ${b}. Graduate through milestones at ChessSchool.`
    : `Journey through ${title} — structured chess classes at ChessSchool.`;
}

export const HOME_TITLE = "Learn Chess Online — Free Chess School";
export const HOME_DESCRIPTION =
  "Learn chess from scratch with ChessSchool — a free online chess academy. Structured classes, tactics puzzles, placement test, play vs bots, and live multiplayer. Start your chess journey today.";

export const ACADEMY_TITLE = "Academy Campus — ChessSchool";
export const ACADEMY_DESCRIPTION =
  "Your chess campus — graduate through schools, semesters, and classes. Resume lessons, daily puzzles, and homework at ChessSchool.";

/** Target search phrases — used in metadata and structured data. */
export const SEO_KEYWORDS = [
  "learn chess",
  "learn chess online",
  "chess school",
  "chess academy",
  "chess lessons",
  "chess classes",
  "chess puzzles",
  "chess for beginners",
  "online chess school",
  "free chess lessons",
];

type SocialOpts = {
  title: string;
  description: string;
  path: string;
  kind?: "home" | "lesson" | "class" | "game" | "play";
  emoji?: string;
  badge?: string;
  imageTitle?: string;
  imageSubtitle?: string;
};

function ogImagePath(opts: SocialOpts): string {
  const q = new URLSearchParams({ kind: opts.kind ?? "home" });
  q.set("title", opts.imageTitle ?? opts.title);
  q.set("subtitle", opts.imageSubtitle ?? opts.description);
  if (opts.emoji) q.set("emoji", opts.emoji);
  if (opts.badge) q.set("badge", opts.badge);
  return `/api/og?${q.toString()}`;
}

/** Open Graph + Twitter metadata with a rich 1200×630 preview image. */
export function socialMetaForSite(siteUrl: string, opts: SocialOpts) {
  const origin = trimOrigin(siteUrl);
  const url = opts.path.startsWith("http") ? opts.path : canonicalForSite(origin, opts.path);
  const image = `${origin}${ogImagePath(opts)}`;
  const alt = `${opts.title} — ${siteName}`;
  const isProduction = isProductionSiteUrl(origin);

  return {
    alternates: { canonical: url },
    openGraph: {
      type: "website" as const,
      url,
      siteName,
      locale: "en_US",
      title: opts.title,
      description: opts.description,
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image" as const,
      title: opts.title,
      description: opts.description,
      images: [{ url: image, alt }],
    },
    robots: metadataRobots(isProduction),
  };
}

export async function pageSocialMeta(opts: SocialOpts) {
  const siteUrl = await resolveSiteUrl();
  return socialMetaForSite(siteUrl, opts);
}

/** @deprecated Use pageSocialMeta or socialMetaForSite with a resolved site URL. */
export function socialMeta(opts: SocialOpts) {
  return socialMetaForSite(
    resolveSiteUrlFromInput(
      {
        NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
        VERCEL_URL: process.env.VERCEL_URL,
      },
      null,
    ),
    opts,
  );
}

export type RobotsRoute = {
  rules: { userAgent: string; allow?: string; disallow: string | string[] };
  sitemap?: string;
};

export function robotsRouteForSite(siteUrl: string): RobotsRoute {
  const origin = trimOrigin(siteUrl);
  if (!isProductionSiteUrl(origin)) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] },
    sitemap: `${origin}/sitemap.xml`,
  };
}
