import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { NavButton } from "@/components/ui/NavButton";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import {
  CURRICULUM_HIGHLIGHTS,
  LEARN_CHESS_SECTIONS,
  SEO_FAQ,
} from "@/lib/seo/content";
import { socialMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Chess Online — Free Lessons & Chess School",
  description:
    "Learn chess online for free with structured classes, tactics puzzles, and live play. ChessSchool is an online chess academy for beginners through advanced players.",
  ...socialMeta({
    title: "Learn Chess Online — Free Chess School",
    description: "Structured chess classes, puzzles, bots, and live multiplayer — 100% free.",
    path: "/learn-chess",
    kind: "home",
    badge: "Learn Chess",
    emoji: "🎓",
  }),
};

export default function LearnChessPage() {
  return (
    <AppShell>
      <FaqJsonLd items={SEO_FAQ} />
      <article className="flex flex-col gap-8 pb-6">
        <header className="flex flex-col gap-3">
          <p className="text-xs font-extrabold uppercase tracking-wide text-brand">Free online chess school</p>
          <h1 className="text-2xl font-extrabold leading-tight text-ink sm:text-3xl">
            Learn chess online — structured classes, not random puzzles
          </h1>
          <p className="text-sm font-semibold leading-relaxed text-ink-600">
            ChessSchool is a free chess academy in your browser. Graduate through semesters — from the chess board and
            piece moves to openings, tactics, endgames, and live multiplayer. No download required to start learning
            chess today.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <NavButton href="/register" size="sm">
              Enroll free →
            </NavButton>
            <NavButton href="/class/class-pre-board" variant="outline" size="sm">
              Start as a beginner
            </NavButton>
            <NavButton href="/placement" variant="ghost" size="sm">
              Placement test
            </NavButton>
          </div>
        </header>

        {LEARN_CHESS_SECTIONS.map((section) => (
          <section key={section.id} aria-labelledby={`${section.id}-heading`}>
            <h2 id={`${section.id}-heading`} className="text-lg font-extrabold text-ink">
              {section.title}
            </h2>
            <p className="mt-2 text-sm font-semibold leading-relaxed text-ink-600">{section.body}</p>
          </section>
        ))}

        <section aria-labelledby="curriculum-heading">
          <h2 id="curriculum-heading" className="mb-3 text-lg font-extrabold text-ink">
            Popular chess classes
          </h2>
          <CurriculumLinkGrid links={CURRICULUM_HIGHLIGHTS} />
          <p className="mt-3 text-xs font-semibold text-ink-500">
            Browse the full{" "}
            <Link href="/library" className="font-bold text-brand underline-offset-2 hover:underline">
              lesson library
            </Link>{" "}
            — 1,600+ FEN-verified lessons.
          </p>
        </section>

        <FaqSection items={SEO_FAQ} />

        <section className="rounded-card border border-brand/20 bg-brand/5 p-4 text-center">
          <p className="text-sm font-extrabold text-ink">Ready to learn chess?</p>
          <p className="mt-1 text-xs font-semibold text-ink-500">Join thousands of students at the academy — free forever.</p>
          <NavButton href="/" size="sm" className="mt-3">
            Open ChessSchool →
          </NavButton>
        </section>
      </article>
    </AppShell>
  );
}
