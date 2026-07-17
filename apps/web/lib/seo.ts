export const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://chess-school.in";
export const siteName = "ChessSchool";

export function canonical(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${siteUrl}${p}`;
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
export function socialMeta(opts: SocialOpts) {
  const url = opts.path.startsWith("http") ? opts.path : canonical(opts.path);
  const image = ogImagePath(opts);
  const alt = `${opts.title} — ${siteName}`;

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
  };
}
