import { JsonLd } from "@/components/seo/JsonLd";
import type { FaqItem } from "@/lib/seo/content";

/** FAQPage structured data — eligible for rich results in Google. */
export function FaqJsonLd({ items }: { items: FaqItem[] }) {
  return (
    <JsonLd
      data={{
        "@context": "https://schema.org",
        "@type": "FAQPage",
        mainEntity: items.map((item) => ({
          "@type": "Question",
          name: item.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: item.answer,
          },
        })),
      }}
    />
  );
}
