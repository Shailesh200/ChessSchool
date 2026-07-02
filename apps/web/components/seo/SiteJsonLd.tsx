import { JsonLd } from "@/components/seo/JsonLd";
import { HOME_DESCRIPTION, HOME_TITLE, SEO_KEYWORDS, siteName, siteUrl } from "@/lib/seo";

/** Homepage structured data for Google (WebSite + educational org). */
export function SiteJsonLd() {
  return (
    <>
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: siteName,
          alternateName: ["Chess School", "Learn Chess Online"],
          url: siteUrl,
          description: HOME_DESCRIPTION,
          inLanguage: "en",
          keywords: SEO_KEYWORDS.join(", "),
          potentialAction: {
            "@type": "SearchAction",
            target: `${siteUrl}/library?q={search_term_string}`,
            "query-input": "required name=search_term_string",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": ["Organization", "EducationalOrganization"],
          name: siteName,
          url: siteUrl,
          logo: `${siteUrl}/icons/icon-512.png`,
          description: HOME_DESCRIPTION,
          sameAs: [],
          offers: {
            "@type": "Offer",
            price: "0",
            priceCurrency: "USD",
            description: "Free chess lessons and puzzles",
          },
        }}
      />
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Course",
          name: HOME_TITLE,
          description: HOME_DESCRIPTION,
          provider: { "@type": "Organization", name: siteName, url: siteUrl },
          isAccessibleForFree: true,
          educationalLevel: "Beginner to Advanced",
          teaches: "Chess — tactics, openings, endgames, and live play",
          inLanguage: "en",
          url: siteUrl,
        }}
      />
    </>
  );
}
