import Link from "next/link";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { CURRICULUM_HIGHLIGHTS, SEO_FAQ } from "@/lib/seo/content";

/** Crawlable SEO content on the homepage — below the interactive campus map. */
export function HomeSeoSection() {
  return (
    <section
      aria-labelledby="about-chessschool"
      className="border-hairline flex flex-col gap-6 border-t pt-6"
    >
      <FaqJsonLd items={SEO_FAQ} />
      <div>
        <h2 id="about-chessschool" className="text-ink text-lg font-extrabold">
          Learn chess online — free chess school
        </h2>
        <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
          ChessSchool is a free online chess academy with structured classes, tactics
          puzzles, and live multiplayer. Whether you&apos;re searching for chess
          lessons, a chess school for beginners, or a place to play chess online, start
          here and graduate through real milestones — from the board and pieces to
          openings, tactics, and endgames.
        </p>
        <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
          New to chess? Try our{" "}
          <Link
            href="/chess-for-beginners"
            className="text-brand font-bold underline-offset-2 hover:underline"
          >
            beginner guide
          </Link>{" "}
          or read how to{" "}
          <Link
            href="/learn-chess"
            className="text-brand font-bold underline-offset-2 hover:underline"
          >
            learn chess online
          </Link>
          .
        </p>
      </div>

      <div>
        <h3 className="text-ink mb-3 text-base font-extrabold">Start learning</h3>
        <CurriculumLinkGrid links={CURRICULUM_HIGHLIGHTS.slice(0, 4)} />
      </div>

      <FaqSection title="Chess school FAQ" items={SEO_FAQ.slice(0, 4)} />
    </section>
  );
}
