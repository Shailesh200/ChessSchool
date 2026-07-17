import Image from "next/image";
import Link from "next/link";
import { STAGES } from "@/content/school";
import { Card } from "@/components/ui/Card";
import { NavButton } from "@/components/ui/NavButton";
import { type IconName } from "@/components/ui/Icon";
import { IconBadge } from "@/components/ui/IconBadge";
import { ContentIcon } from "@/components/ui/ContentIcon";
import { FlatAvatar } from "@/components/ui/flatAvatars/FlatAvatar";
import { COACH_AVATAR } from "@/components/ui/iconMaps";
import type { FlatAvatarId } from "@/components/ui/flatAvatars/catalog";
import { CurriculumLinkGrid } from "@/components/seo/CurriculumLinkGrid";
import { FaqSection } from "@/components/seo/FaqSection";
import { FaqJsonLd } from "@/components/seo/FaqJsonLd";
import { SiteJsonLd } from "@/components/seo/SiteJsonLd";
import { LandingPrimaryCtas } from "@/components/landing/LandingPrimaryCtas";
import { CURRICULUM_HIGHLIGHTS, SEO_FAQ } from "@/lib/seo/content";
import type { CurriculumSkeleton } from "@/features/school/curriculum-skeleton.server";

const COACH_PERSONALITIES: { id: string; label: string; avatar: FlatAvatarId }[] = [
  { id: "friendly", label: "Friendly", avatar: COACH_AVATAR.friendly! },
  { id: "strict", label: "Strict", avatar: COACH_AVATAR.strict! },
  { id: "mentor", label: "Mentor", avatar: COACH_AVATAR.mentor! },
  { id: "tactical", label: "Tactical", avatar: COACH_AVATAR.tactical! },
  { id: "minimal", label: "Minimal", avatar: "ava-owl" },
];

const STAT_ICONS: { label: string; icon: IconName }[] = [
  { label: "Schools", icon: "cap" },
  { label: "Semesters", icon: "book" },
  { label: "Classes", icon: "building" },
  { label: "Lessons", icon: "puzzle" },
];

const FEATURES = [
  {
    icon: "learn" as const,
    title: "Structured curriculum",
    body: "Graduate through schools — Pre-School to University — with semesters, classes, and exams.",
  },
  {
    icon: "puzzle" as const,
    title: "FEN-verified puzzles",
    body: "Thousands of rated tactics and homework drills, tagged by concept and stage.",
  },
  {
    icon: "robot" as const,
    title: "Play vs bots",
    body: "Adaptive AI from 300–2000 ELO, clocks, material tracking, and match review.",
  },
  {
    icon: "users" as const,
    title: "Live multiplayer",
    body: "Share a link and play a friend online — clocks, resign, and realtime sync.",
  },
  {
    icon: "brain" as const,
    title: "Assisted play",
    body: "Coach explains every move — full games and puzzle drills tuned to your rating.",
  },
  {
    icon: "trophy" as const,
    title: "Arena & shadow",
    body: "Round-robin bot tournaments and rematch saved games move-for-move.",
  },
] as const;

const HOW_IT_WORKS = [
  {
    step: "1",
    title: "Enroll free",
    body: "Create a student account — progress syncs across web and app.",
  },
  {
    step: "2",
    title: "Placement test",
    body: "Eight puzzles place you in Elementary, Middle, or High School.",
  },
  {
    step: "3",
    title: "Campus journey",
    body: "Unlock classes on the campus map and pass exams to graduate.",
  },
  {
    step: "4",
    title: "Play & improve",
    body: "Bots, assisted play, arena, and review — all in one academy.",
  },
] as const;

export function LandingPage({ stats }: { stats: CurriculumSkeleton }) {
  const stageCount = STAGES.length;
  const semesterCount = stats.semesters.length;
  const classCount = stats.classes.length;
  const lessonCount = stats.lessons.length;

  return (
    <>
      <SiteJsonLd />
      <FaqJsonLd items={SEO_FAQ} />

      {/* Hero */}
      <section className="flex flex-col gap-8 lg:flex-row lg:items-center lg:gap-12">
        <div className="flex flex-1 flex-col gap-4">
          <p className="text-brand text-xs font-extrabold tracking-wide uppercase">
            Free online chess academy
          </p>
          <h1 className="text-ink text-3xl leading-tight font-extrabold sm:text-4xl lg:text-5xl">
            Learn chess like a real school — not an endless puzzle feed
          </h1>
          <p className="text-ink-600 max-w-xl text-base leading-relaxed font-semibold">
            ChessSchool is a premium chess-learning academy: structured classes, coach
            narration, placement tests, bot play, and live multiplayer. Graduate from
            the board and pieces to openings, tactics, and endgames — free in your
            browser or as an app.
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <LandingPrimaryCtas enrollLabel="Enroll free →" />
            <NavButton href="/class/class-pre-board" variant="ghost" size="lg">
              Start as beginner
            </NavButton>
          </div>
          <p className="text-ink-500 text-xs font-semibold">
            No credit card · Works offline as a PWA · Android &amp; iOS apps available
          </p>
        </div>
        <div className="relative mx-auto w-full max-w-sm shrink-0 lg:max-w-md">
          <Image
            src="/mascots/cody-wave-v2.png"
            alt="Cody, your chess coach mascot"
            width={400}
            height={400}
            className="mx-auto"
            priority
          />
        </div>
      </section>

      {/* Stats */}
      <section
        aria-label="Academy at a glance"
        className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {STAT_ICONS.map((meta, i) => {
          const values = [
            stageCount,
            semesterCount,
            classCount,
            lessonCount.toLocaleString(),
          ];
          return (
            <Card
              key={meta.label}
              className="flex flex-col items-center gap-2 text-center"
            >
              <IconBadge name={meta.icon} size="md" tone="brand" />
              <div className="text-ink text-2xl font-extrabold tabular-nums">
                {values[i]}
              </div>
              <div className="text-ink-500 text-xs font-bold">{meta.label}</div>
            </Card>
          );
        })}
      </section>

      {/* How it works */}
      <section className="mt-14" aria-labelledby="how-heading">
        <h2 id="how-heading" className="text-ink text-xl font-extrabold">
          How ChessSchool works
        </h2>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.step} className="flex flex-col gap-2">
              <span className="bg-brand flex h-8 w-8 items-center justify-center rounded-full text-sm font-extrabold text-white">
                {item.step}
              </span>
              <h3 className="text-ink text-sm font-extrabold">{item.title}</h3>
              <p className="text-ink-500 text-xs leading-relaxed font-semibold">
                {item.body}
              </p>
            </Card>
          ))}
        </ol>
      </section>

      {/* Features */}
      <section className="mt-14" aria-labelledby="features-heading">
        <h2 id="features-heading" className="text-ink text-xl font-extrabold">
          Everything in one academy
        </h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} className="flex gap-3">
              <IconBadge name={f.icon} size="md" tone="brand" />
              <div>
                <h3 className="text-ink text-sm font-extrabold">{f.title}</h3>
                <p className="text-ink-500 mt-1 text-xs leading-relaxed font-semibold">
                  {f.body}
                </p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Schools preview */}
      <section className="mt-14" aria-labelledby="schools-heading">
        <h2 id="schools-heading" className="text-ink text-xl font-extrabold">
          {stageCount} schools — one clear path
        </h2>
        <p className="text-ink-600 mt-2 max-w-2xl text-sm font-semibold">
          From Pre-School (board setup and piece moves) through Elementary, Middle
          School, High School, and University — each stage unlocks when you graduate the
          last.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAGES.map((stage) => (
            <Card key={stage.id} className="flex items-start gap-3">
              <ContentIcon emoji={stage.emoji} size={28} tone="brand" selected />
              <div>
                <h3 className="text-ink text-sm font-extrabold">{stage.name}</h3>
                <p className="text-ink-500 mt-1 text-xs font-semibold">{stage.blurb}</p>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* Coach voices */}
      <section className="mt-14" aria-labelledby="coaches-heading">
        <h2 id="coaches-heading" className="text-ink text-xl font-extrabold">
          Pick your coach
        </h2>
        <p className="text-ink-600 mt-2 text-sm font-semibold">
          Five coach personalities narrate lessons, matches, and assisted play — with
          optional voice playback.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {COACH_PERSONALITIES.map((v) => (
            <span
              key={v.id}
              className="rounded-pill border-hairline bg-surface-card flex items-center gap-2.5 border py-1.5 pr-3 pl-1.5 text-sm font-bold"
            >
              <FlatAvatar id={v.avatar} size={32} />
              {v.label}
            </span>
          ))}
        </div>
      </section>

      {/* Curriculum links */}
      <section className="mt-14" aria-labelledby="start-heading">
        <h2 id="start-heading" className="text-ink text-xl font-extrabold">
          Popular classes to start
        </h2>
        <div className="mt-4">
          <CurriculumLinkGrid links={CURRICULUM_HIGHLIGHTS} />
        </div>
        <p className="text-ink-500 mt-3 text-xs font-semibold">
          Browse the full{" "}
          <Link
            href="/library"
            className="text-brand font-bold underline-offset-2 hover:underline"
          >
            lesson library
          </Link>{" "}
          or open the{" "}
          <Link
            href="/academy"
            className="text-brand font-bold underline-offset-2 hover:underline"
          >
            campus map
          </Link>
          .
        </p>
      </section>

      {/* SEO internal links */}
      <section className="mt-10 flex flex-wrap gap-2">
        <NavButton href="/learn-chess" variant="outline" size="sm">
          Learn chess online
        </NavButton>
        <NavButton href="/chess-for-beginners" variant="outline" size="sm">
          Chess for beginners
        </NavButton>
        <NavButton href="/placement" variant="ghost" size="sm">
          Placement test
        </NavButton>
        <NavButton href="/play" variant="ghost" size="sm">
          Play chess
        </NavButton>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-hairline mt-14 scroll-mt-20 border-t pt-10">
        <FaqSection title="Chess school FAQ" items={SEO_FAQ} />
      </section>

      {/* Final CTA */}
      <section className="rounded-card border-brand/25 bg-brand/5 mt-12 border p-6 text-center">
        <IconBadge name="cap" size="lg" tone="gold" className="mx-auto" />
        <h2 className="text-ink mt-3 text-lg font-extrabold">Ready to graduate?</h2>
        <p className="text-ink-500 mx-auto mt-2 max-w-md text-sm font-semibold">
          Join ChessSchool free — save progress, earn achievements, and play across web
          and mobile.
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          <LandingPrimaryCtas enrollLabel="Enroll now" />
        </div>
      </section>
    </>
  );
}
