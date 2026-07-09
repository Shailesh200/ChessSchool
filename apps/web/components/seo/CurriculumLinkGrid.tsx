import Link from "next/link";
import type { CurriculumLink } from "@/lib/seo/content";
import { Icon } from "@/components/ui/Icon";

/** Internal link grid — helps crawlers discover key curriculum pages. */
export function CurriculumLinkGrid({ links }: { links: CurriculumLink[] }) {
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link
            href={link.href}
            className="btn-tactile rounded-card border-hairline bg-surface-card flex h-full items-start gap-3 border p-4 [box-shadow:var(--shadow-card)]"
          >
            <span className="text-2xl" aria-hidden>
              {link.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-ink block text-sm font-extrabold">
                {link.title}
              </span>
              <span className="text-ink-500 mt-0.5 block text-xs leading-snug font-semibold">
                {link.description}
              </span>
            </span>
            <Icon name="arrowRight" size={18} className="text-brand mt-0.5 shrink-0" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
