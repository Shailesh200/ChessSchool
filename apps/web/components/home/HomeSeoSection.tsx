import Link from "next/link";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { CURRICULUM_HIGHLIGHTS, SEO_FAQ } from "@/lib/seo/content";

/** Crawlable SEO content on the homepage — below the interactive campus map. */
export function HomeSeoSection() {
  return (
    <section aria-labelledby="about-chessschool" className="flex flex-col gap-6 border-t border-hairline pt-6">
      <FaqJsonLd items={SEO_FAQ} />
      <div>
        <h2 id="about-chessschool" className="text-lg font-extrabold text-ink">
          Learn chess online — free chess school
        </h2>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-600">
          ChessSchool is a free online chess academy with structured classes, tactics puzzles, and live multiplayer.
          Whether you&apos;re searching for chess lessons, a chess school for beginners, or a place to play chess
          online, start here and graduate through real milestones — from the board and pieces to openings, tactics, and
          endgames.
        </p>
        <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-600">
          New to chess? Try our{" "}
          <Link href="/chess-for-beginners" className="font-bold text-brand underline-offset-2 hover:underline">
            beginner guide
          </Link>{" "}
          or read how to{" "}
          <Link href="/learn-chess" className="font-bold text-brand underline-offset-2 hover:underline">
            learn chess online
          </Link>
          .
        </p>
      </div>

      <div>
        <h3 className="mb-3 text-base font-extrabold text-ink">Start learning</h3>
        <CurriculumLinkGrid links={CURRICULUM_HIGHLIGHTS.slice(0, 4)} />
      </div>

      <FaqSection title="Chess school FAQ" items={SEO_FAQ.slice(0, 4)} />
    </section>
  );
}
