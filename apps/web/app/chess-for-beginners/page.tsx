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
    description:
      "Start from zero — board, pieces, checkmate, and notation with a friendly coach.",
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
          <p className="text-brand text-xs font-extrabold tracking-wide uppercase">
            Chess for beginners
          </p>
          <h1 className="text-ink text-2xl leading-tight font-extrabold sm:text-3xl">
            Learn chess from scratch — board, pieces &amp; rules
          </h1>
          <p className="text-ink-600 text-sm leading-relaxed font-semibold">
            {BEGINNER_INTRO}
          </p>
          <NavButton href="/class/class-pre-board" size="sm" className="self-start">
            Start Pre-School →
          </NavButton>
        </header>

        <section aria-labelledby="preschool-heading">
          <h2 id="preschool-heading" className="text-ink mb-3 text-lg font-extrabold">
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
                href: "/class/class-pre-moves",
                title: "Piece Moves",
                description: "Hands-on practice for every piece type.",
                emoji: "♟️",
              },
              {
                href: "/class/class-pre-capture",
                title: "Capture & Blocking",
                description: "Taking pieces and blocked paths.",
                emoji: "⚔️",
              },
              {
                href: "/class/class-pre-special",
                title: "Special Moves",
                description: "Promotion, castling, and en passant.",
                emoji: "✨",
              },
              {
                href: "/class/class-pre-endings",
                title: "How Games End",
                description: "Check, checkmate, stalemate, and draws.",
                emoji: "🏁",
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
          <h2 id="after-heading" className="text-ink text-lg font-extrabold">
            Already know the basics?
          </h2>
          <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
            Take the 8-puzzle placement test (~2 minutes). We&apos;ll recommend
            Elementary, Middle, or High School so you skip material you already know.
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
