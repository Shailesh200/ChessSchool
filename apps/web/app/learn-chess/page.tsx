import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { NavButton } from "@/components/ui/NavButton";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { CURRICULUM_HIGHLIGHTS, LEARN_CHESS_SECTIONS } from "@/lib/seo/content";
import { socialMeta } from "@/lib/seo";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Learn Chess Online — Free Lessons & Chess School",
  description:
    "Learn chess online for free with structured classes, tactics puzzles, and live play. ChessSchool is an online chess academy for beginners through advanced players.",
  ...socialMeta({
    title: "Learn Chess Online — Free Chess School",
    description:
      "Structured chess classes, puzzles, bots, and live multiplayer — 100% free.",
    path: "/learn-chess",
    kind: "home",
    badge: "Learn Chess",
    emoji: "🎓",
  }),
};

export default function LearnChessPage() {
  return (
    <AppShell>
      <article className="flex flex-col gap-8 pb-6">
        <header className="flex flex-col gap-3">
          <p className="text-brand text-xs font-extrabold tracking-wide uppercase">
            Free online chess school
          </p>
          <h1 className="text-ink text-2xl leading-tight font-extrabold sm:text-3xl">
            Learn chess online — structured classes, not random puzzles
          </h1>
          <p className="text-ink-600 text-sm leading-relaxed font-semibold">
            ChessSchool is a free chess academy in your browser. Graduate through
            semesters — from the chess board and piece moves to openings, tactics,
            endgames, and live multiplayer. No download required to start learning chess
            today.
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
            <h2
              id={`${section.id}-heading`}
              className="text-ink text-lg font-extrabold"
            >
              {section.title}
            </h2>
            <p className="text-ink-600 mt-2 text-sm leading-relaxed font-semibold">
              {section.body}
            </p>
          </section>
        ))}

        <section aria-labelledby="curriculum-heading">
          <h2 id="curriculum-heading" className="text-ink mb-3 text-lg font-extrabold">
            Popular chess classes
          </h2>
          <CurriculumLinkGrid links={CURRICULUM_HIGHLIGHTS} />
          <p className="text-ink-500 mt-3 text-xs font-semibold">
            Browse the full{" "}
            <Link
              href="/library"
              className="text-brand font-bold underline-offset-2 hover:underline"
            >
              lesson library
            </Link>{" "}
            — 1,600+ FEN-verified lessons.
          </p>
        </section>

        <section aria-labelledby="faq-link-heading">
          <h2 id="faq-link-heading" className="text-ink text-lg font-extrabold">
            Common questions
          </h2>
          <p className="text-ink-600 mt-2 text-sm font-semibold">
            Answers about pricing, multiplayer, apps, and how long it takes to learn are
            on our{" "}
            <Link
              href="/#faq"
              className="text-brand font-bold underline-offset-2 hover:underline"
            >
              chess school FAQ
            </Link>
            .
          </p>
        </section>

        <section className="rounded-card border-brand/20 bg-brand/5 border p-4 text-center">
          <p className="text-ink text-sm font-extrabold">Ready to learn chess?</p>
          <p className="text-ink-500 mt-1 text-xs font-semibold">
            Join thousands of students at the academy — free forever.
          </p>
          <NavButton href="/academy" size="sm" className="mt-3">
            Open the academy →
          </NavButton>
        </section>
      </article>
    </AppShell>
  );
}
