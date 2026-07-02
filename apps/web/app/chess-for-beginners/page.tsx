import { AppShell } from "@/components/layout/AppShell";
import { NavButton } from "@/components/ui/NavButton";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { BEGINNER_FAQ, BEGINNER_INTRO } from "@/lib/seo/content";
import { socialMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Chess for Beginners — Learn from Zero",
  description:
    "Chess for beginners: learn the board, pieces, rules, and notation step by step. Free Pre-School classes with interactive puzzles at ChessSchool.",
  ...socialMeta({
    title: "Chess for Beginners",
    description: "Start from zero — board, pieces, checkmate, and notation with a friendly coach.",
    path: "/chess-for-beginners",
    kind: "home",
    badge: "Beginners",
    emoji: "🧸",
  }),
};

export default function ChessForBeginnersPage() {
  return (
    <AppShell>
      <FaqJsonLd items={BEGINNER_FAQ} />
      <article className="flex flex-col gap-8 pb-6">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand">Chess for beginners</p>
          <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
            Learn chess from scratch — board, pieces &amp; rules
          </h1>
          <p className="text-sm font-semibold leading-relaxed text-ink-600">{BEGINNER_INTRO}</p>
          <NavButton href="/class/class-pre-board" size="sm" className="self-start">
            Start Pre-School →
          </NavButton>
        </header>

        <section aria-labelledby="preschool-heading">
          <h2 id="preschool-heading" className="mb-3 text-lg font-extrabold text-ink">
            Pre-School classes for new players
          </h2>
          <CurriculumLinkGrid
            links={[
              {
                href: "/class/class-pre-board",
                title: "The Chess Board",
                description: "64 squares, setup, files, ranks, and coordinates.",
                emoji: "🗺️",
              },
              {
                href: "/class/class-pre-pieces",
                title: "The Pieces",
                description: "Meet every piece and what it can do.",
                emoji: "♞",
              },
              {
                href: "/class/class-pre-rules",
                title: "Chess Rules",
                description: "Check, checkmate, stalemate, promotion, castling.",
                emoji: "📜",
              },
              {
                href: "/class/class-pre-moves",
                title: "Piece Moves",
                description: "Hands-on puzzles for every piece type.",
                emoji: "♟️",
              },
              {
                href: "/class/class-pre-language",
                title: "Chess Language",
                description: "Read and write moves — Nf3, Qd5, O-O.",
                emoji: "📝",
              },
            ]}
          />
        </section>

        <section aria-labelledby="after-heading">
          <h2 id="after-heading" className="text-lg font-extrabold text-ink">
            Already know the basics?
          </h2>
          <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-600">
            Take the 8-puzzle placement test (~2 minutes). We&apos;ll recommend Elementary, Middle, or High School so
            you skip material you already know.
          </p>
          <NavButton href="/placement" variant="outline" size="sm" className="mt-3">
            Take placement test →
          </NavButton>
        </section>

        <FaqSection title="Beginner FAQ" items={BEGINNER_FAQ} />
      </article>
    </AppShell>
  );
}
