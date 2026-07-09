import type { FaqItem } from "@/lib/seo/content";

/** Visible FAQ block — matches FaqJsonLd for SEO + human readers. */
export function FaqSection({
  title = "Frequently asked questions",
  items,
}: {
  title?: string;
  items: FaqItem[];
}) {
  return (
    <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
      <h2 id="faq-heading" className="text-ink text-lg font-extrabold">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-card border-hairline bg-surface-card border [box-shadow:var(--shadow-card)]"
          >
            <summary className="text-ink cursor-pointer list-none px-4 py-3 text-sm font-extrabold marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {item.question}
                <span
                  className="text-brand transition group-open:rotate-45"
                  aria-hidden
                >
                  +
                </span>
              </span>
            </summary>
            <p className="border-hairline text-ink-600 border-t px-4 py-3 text-sm leading-relaxed font-semibold">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
