import type { FaqItem } from "@/lib/seo/content";

/** Visible FAQ block — matches FaqJsonLd for SEO + human readers. */
export function FaqSection({ title = "Frequently asked questions", items }: { title?: string; items: FaqItem[] }) {
  return (
    <section aria-labelledby="faq-heading" className="flex flex-col gap-3">
      <h2 id="faq-heading" className="text-lg font-extrabold text-ink">
        {title}
      </h2>
      <div className="flex flex-col gap-2">
        {items.map((item) => (
          <details
            key={item.question}
            className="group rounded-card border border-hairline bg-surface-card [box-shadow:var(--shadow-card)]"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-extrabold text-ink marker:content-none [&::-webkit-details-marker]:hidden">
              <span className="flex items-center justify-between gap-2">
                {item.question}
                <span className="text-brand transition group-open:rotate-45" aria-hidden>
                  +
                </span>
              </span>
            </summary>
            <p className="border-t border-hairline px-4 py-3 text-sm font-semibold leading-relaxed text-ink-600">
              {item.answer}
            </p>
          </details>
        ))}
      </div>
    </section>
  );
}
